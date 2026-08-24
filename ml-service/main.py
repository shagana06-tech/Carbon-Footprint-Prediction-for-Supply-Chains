import os
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from calculator import process_calculations
from ml_engine import predict_corrected, explain_predictions
from train_model import train_correction_model

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}'
)
logger = logging.getLogger("ml-service")

app = FastAPI(title="Carbon ML & Calculation Service")

# ─── Body-size limit middleware ────────────────────────────────────────────────
# Raise the request body limit to 100 MB so large-dataset bulk calculations
# (thousands of activity entries chunked by the Node backend) never hit 413.
class LargeBodyMiddleware(BaseHTTPMiddleware):
    MAX_BODY_SIZE = 100 * 1024 * 1024  # 100 MB

    async def dispatch(self, request: Request, call_next):
        if request.headers.get("content-length"):
            content_length = int(request.headers["content-length"])
            if content_length > self.MAX_BODY_SIZE:
                return JSONResponse(
                    status_code=413,
                    content={"error": "RequestTooLarge", "detail": f"Request body exceeds {self.MAX_BODY_SIZE // (1024*1024)} MB limit"}
                )
        return await call_next(request)

app.add_middleware(LargeBodyMiddleware)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Node handles final origin lock, ML service is internal
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global FastAPI Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception caught: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "InternalServerError", "detail": str(exc)}
    )

# Health Endpoint
@app.get("/health")
def health_check():
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    model_exists = False
    if os.path.exists(models_dir):
        model_exists = os.path.exists(os.path.join(models_dir, "correction_model.joblib"))
        
    return {
        "status": "ok",
        "service": "ml-service",
        "modelsDirectory": {
            "path": models_dir,
            "exists": os.path.exists(models_dir),
            "modelTrained": model_exists
        }
    }

# Placeholders for calculation, correction, SHAP, and report modules
class ActivityEntryInput(BaseModel):
    activityType: str
    quantity: float
    unit: str
    region: str
    equipmentAgeYears: Optional[float] = None
    cargoWeightTons: Optional[float] = None
    supplierId: Optional[str] = None

class CalculateRequest(BaseModel):
    entries: List[ActivityEntryInput]

@app.post("/calculate")
def calculate_emissions(req: CalculateRequest):
    logger.info("Calculate endpoint called")
    entries_list = [entry.model_dump() for entry in req.entries]
    result = process_calculations(entries_list)
    return result

class MLEntryInput(BaseModel):
    baselineKg: float
    activityType: str
    region: str
    equipmentAgeYears: float
    season: str

class MLCorrectRequest(BaseModel):
    entries: List[MLEntryInput]

class WhatIfChange(BaseModel):
    activityType: str
    adjustmentType: str
    adjustmentPct: float

class WhatIfRequest(BaseModel):
    entries: List[ActivityEntryInput]
    changes: List[WhatIfChange]

@app.post("/correct")
def correct_emissions(req: MLCorrectRequest):
    logger.info("Correct endpoint called")
    entries_list = [entry.model_dump() for entry in req.entries]
    result = predict_corrected(entries_list)
    return result

@app.post("/explain")
def explain_emissions(req: MLCorrectRequest):
    logger.info("Explain endpoint called")
    entries_list = [entry.model_dump() for entry in req.entries]
    result = explain_predictions(entries_list)
    return result

@app.post("/train")
def train_model():
    logger.info("Train endpoint called")
    try:
        metrics = train_correction_model()
        return {"status": "success", **metrics}
    except Exception as e:
        logger.error(f"Training failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

@app.post("/whatif")
def whatif_emissions(req: WhatIfRequest):
    logger.info("Whatif endpoint called")
    
    # 1. Calculate original baseline
    original_entries = [e.model_dump() for e in req.entries]
    original_calc = process_calculations(original_entries)
    
    # 2. Build changes map
    # Maps activityType -> adjustmentPct
    adjustment_map = {change.activityType: change.adjustmentPct for change in req.changes}
    
    # 3. Apply percentage reductions to quantities
    adjusted_entries = []
    for entry in original_entries:
        adj_entry = entry.copy()
        activity = entry["activityType"]
        if activity in adjustment_map:
            pct = adjustment_map[activity]
            # Reduce quantity by adjustment percentage (e.g. 30% reduction means quantity is scaled by 0.7)
            adj_entry["quantity"] = entry["quantity"] * (1.0 - (pct / 100.0))
        adjusted_entries.append(adj_entry)
        
    # 4. Re-run pure calculator math
    projected_calc = process_calculations(adjusted_entries)
    
    # 5. Calculate savings
    savings_kg = max(0.0, original_calc["totalKg"] - projected_calc["totalKg"])
    
    return {
        "projectedTotalKg": projected_calc["totalKg"],
        "savingsKg": savings_kg,
        "breakdown": projected_calc["breakdown"]
    }

from report_generator import generate_pdf_report
from fastapi.responses import FileResponse
from fastapi import BackgroundTasks

class ReportRequest(BaseModel):
    period: str
    format: str
    calculation: dict
    explainability: list
    trends: list

@app.post("/report")
def generate_report_pdf(req: ReportRequest, background_tasks: BackgroundTasks):
    logger.info("Report generation endpoint called")
    payload = req.model_dump()
    pdf_path = generate_pdf_report(payload)
    
    def remove_file(path: str):
        try:
            os.remove(path)
        except Exception as e:
            logger.error(f"Error removing temporary PDF file: {str(e)}")
            
    background_tasks.add_task(remove_file, pdf_path)
    
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{req.format}_Report_{req.period}.pdf"
    )
