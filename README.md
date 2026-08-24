# 🌍 CarbonIQ: Carbon Footprint Prediction & Explainable AI for Supply Chains

> **End-to-End ESG & Decarbonization Platform** featuring Scope 1, 2, and 3 GHG emissions accounting, XGBoost Machine Learning emission correction models, SHAP (Shapley Additive exPlanations) model explainability, what-if scenario simulations, Google Gemini 1.5 Flash AI insights, and BRSR/CSRD automated regulatory PDF report generation.

---

## 📌 Table of Contents
1. [Abstract](#-abstract)
2. [Project Objective](#-project-objective)
3. [System Architecture](#-system-architecture)
4. [Core Features & Technical Capabilities](#-core-features--technical-capabilities)
5. [Detailed Modules & Function Reference](#-detailed-modules--function-reference)
   - [Backend Node.js API Gateway (`backend-node`)](#1-backend-nodejs-api-gateway-backend-node)
   - [Python ML Microservice (`ml-service`)](#2-python-ml-microservice-ml-service)
   - [React Frontend Application (`frontend`)](#3-react-frontend-application-frontend)
6. [Database Schemas & Data Models](#-database-schemas--data-models)
7. [Emission Factors & ML Methodology](#-emission-factors--ml-methodology)
8. [API Endpoints Directory](#-api-endpoints-directory)
9. [Local Development & Deployment Guide](#-local-development--deployment-guide)

---

## 📄 Abstract

Corporate supply chains account for over 80% of global greenhouse gas (GHG) emissions. Accurately tracking, analyzing, and reducing these emissions across Scope 1 (Direct Fuels), Scope 2 (Purchased Energy), and Scope 3 (Value Chain Freight & Sourcing) presents severe challenges due to static emission factors, uncaptured operational inefficiencies (e.g., equipment age, seasonal climate variances), and lack of transparent decision-making tools.

**CarbonIQ** bridges this gap by introducing a multi-tiered ESG analytics architecture:
1. **Hybrid Calculation Engine**: Combines verified standard GHG Protocol emission factor tables with dynamic Climatiq API integration.
2. **Machine Learning Emission Correction**: Leverages an **XGBoost Regressor** trained on operational variables (equipment degradation, regional grid mixes, ambient seasonal temperatures) to adjust baseline calculations, reducing discrepancy between standard coefficients and actual real-world emissions.
3. **Explainable AI (XAI)**: Utilizes **SHAP (Shapley Additive exPlanations)** to break down ML model decisions into transparent, plain-language feature contributions, ensuring trust and auditability.
4. **Decarbonization What-If Simulator**: Enables corporate managers to project emission reductions from operational changes (e.g., shifting road transport to rail, transitioning grid power to solar).
5. **Generative AI Insights**: Integrates **Google Gemini 1.5 Flash** to evaluate historical trends and generate actionable, data-driven decarbonization strategies with automated rule-based fallbacks.
6. **Regulatory Compliance Reporting**: Generates downloadable, presentation-grade PDF reports styled after international regulatory frameworks, specifically **BRSR (Business Responsibility and Sustainability Reporting - India)** and **CSRD (Corporate Sustainability Reporting Directive - EU)**.

---

## 🎯 Project Objective

The core objective of CarbonIQ is to empower enterprises with an automated, intelligent, and audited carbon management ecosystem:

- **Accuracy Beyond Static Factors**: Replaces generic static multiplication with ML-corrected operational predictions that account for real-world environmental degradation and seasonal factors.
- **Scope 3 Supply Chain Transparency**: Solves the opacity of upstream supply chain emissions by evaluating freight logistics and material sourcing impact.
- **Auditability & Explainability**: Eliminates "black-box AI" by providing mathematically backed SHAP explainability breakdowns for every prediction.
- **Interactive Decarbonization Planning**: Delivers real-time scenario simulation to evaluate ROI and carbon savings before committing capital to green transition projects.
- **Automated Regulatory Compliance**: Reduces reporting overhead from weeks to seconds by auto-compiling BRSR and CSRD audit summaries complete with visual charts and executive recommendations.

---

## 🏗️ System Architecture

The platform is designed as a modular, container-ready microservices architecture:

```
                  +-----------------------------------+
                  |   React 18 + Vite + TypeScript    |
                  |   (Frontend User Interface)       |
                  +-----------------+-----------------+
                                    | HTTP / REST API (JWT)
                                    v
                  +-----------------------------------+
                  |      Express.js Node Gateway      |
                  |   (Auth, Business Logic, DB)      |
                  +--------+----------------+---------+
                           |                |
             MongoDB Store |                | REST / Axios Proxy
                           v                v
                  +-----------------+ +----------------------------------+
                  | MongoDB Database| |    Python FastAPI ML Service     |
                  | (User, Activity,| |  (XGBoost, SHAP, ReportLab PDF,  |
                  |  Results, DB)   | |   Climatiq Factor Integration)   |
                  +-----------------+ +-----------------+----------------+
                                                        |
                                                        v
                                          +----------------------------+
                                          | Google Gemini 1.5 Flash AI |
                                          | (Executive Strategic Text) |
                                          +----------------------------+
```

---

## ⭐ Core Features & Technical Capabilities

- 🔐 **Multi-Tenant JWT Authentication & RBAC**: Scopes all activity data, calculations, simulations, and PDF archives securely by company.
- ⚡ **Scope 1, 2 & 3 Emission Calculation**: Native support for grid electricity, diesel fuel combustion, road transport logistics, and raw material sourcing.
- 🤖 **XGBoost Emission Correction Engine**: Machine learning model that predicts emission adjustments based on equipment age, weather season, and regional grid intensity.
- 📊 **SHAP Explainable AI**: Generates percentage contribution scores and plain-language driver descriptions for every ML calculation.
- 🎛️ **Interactive What-If Scenario Simulator**: Multi-slider interface simulating percentage reductions across transport, fuel, energy, and material categories.
- 📜 **Regulatory PDF Generator (BRSR & CSRD)**: Built-in ReportLab engine generating PDF reports with Matplotlib pie charts, trend graphs, and audit sign-off footers.
- 💡 **Google Gemini 1.5 Flash AI Insights**: Contextual LLM analysis summarizing hotspots, YoY performance, and strategic ESG recommendations.
- 📂 **Bulk CSV Upload & Data Management**: Client-side drag-and-drop CSV parsing with instant backend batch insertion and recalculation.
- 📊 **Real-time Recharts Dashboard**: Visually rich dashboard displaying key ESG KPIs, historical multi-year trends, scope breakdowns, and SHAP explainability.

---

## 🔍 Detailed Modules & Function Reference

### 1. Backend Node.js API Gateway (`backend-node`)

The Node.js backend manages API requests, database persistence, security, and orchestrates calls to the Python ML microservice.

#### 📁 `src/controllers/auth.controller.ts`
- `register(req: Request, res: Response)`: Registers a new user and company profile. Hashes passwords using `bcryptjs` (salt 10), initializes company record in MongoDB, and issues a 24-hour JWT token.
- `login(req: Request, res: Response)`: Authenticates user credentials against stored bcrypt hashes, validates active company association, and returns a signed JWT token.

#### 📁 `src/controllers/activity.controller.ts`
- `createActivityEntry(req: AuthenticatedRequest, res: Response)`: Validates input fields (quantity > 0, required cargo weight for road transport), persists single activity record, and triggers background recalculation.
- `bulkUploadCSV(req: AuthenticatedRequest, res: Response)`: Handles batch activity entry array uploads, validates entries, executes bulk MongoDB insertion via `insertMany()`, and triggers batch recalculation across all affected periods.
- `getActivityEntries(req: AuthenticatedRequest, res: Response)`: Retrieves paginated activity records for the authenticated company, supporting period filters.
- `deleteActivityEntry(req: AuthenticatedRequest, res: Response)`: Removes an activity record by ID and re-triggers recalculation for the affected reporting period.
- `recalculateEmissions(companyId: string, period: string)`: **Core Orchestrator Function**. Fetches activity entries, contacts ML service `/calculate` for baseline emissions, determines season from date period, calls `/correct` for XGBoost prediction, calls `/explain` for SHAP factors, and updates MongoDB `CalculationResult` and `ExplainabilityResult`.

#### 📁 `src/controllers/dashboard.controller.ts`
- `getDashboardSummary(req: AuthenticatedRequest, res: Response)`: Returns calculation totals, scope breakdown, and SHAP explainability results for a specific period. Automatically triggers recalculation if missing.
- `getDashboardTrend(req: AuthenticatedRequest, res: Response)`: Retrieves all historical `CalculationResult` documents for the company sorted chronologically to render multi-year trend charts.
- `seedAppleDemoData(req: AuthenticatedRequest, res: Response)`: Utility function that populates demo multi-year ESG dataset (Scope 1/2/3 historical records) for instant UI demonstration.

#### 📁 `src/controllers/simulator.controller.ts`
- `runWhatIfSimulation(req: AuthenticatedRequest, res: Response)`: Fetches current period activity entries, forwards raw entries and user slider change parameters (`adjustmentPct`, `activityType`) to the Python `/whatif` endpoint, and returns projected total emissions and savings.

#### 📁 `src/controllers/report.controller.ts`
- `generateReport(req: AuthenticatedRequest, res: Response)`: Fetches calculation metrics, SHAP factors, and historical trends for a period. Streams payload to Python `/report` endpoint, receives generated PDF binary, saves to `/public/reports`, registers MongoDB `Report` document, and streams file attachment to client.
- `getReportsList(req: AuthenticatedRequest, res: Response)`: Returns catalog of generated PDF reports for the company sorted by creation date.
- `downloadReportFile(req: AuthenticatedRequest, res: Response)`: Serves existing PDF report binary from disk archive given a report document ID.

#### 📁 `src/controllers/ai.controller.ts`
- `getAiInsights(req: AuthenticatedRequest, res: Response)`: Assembles corporate emissions prompt (footprint, scope breakdown, YoY trends, SHAP factors) and invokes **Google Gemini 1.5 Flash** (`@google/generative-ai`).
- `generateFallbackInsights(calc: any, trends: any[])`: Rule-based fallback engine executing algorithmically generated ESG recommendations when Gemini API key is missing or quota limit is reached.

#### 📁 `src/middleware/auth.middleware.ts`
- `authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction)`: Intercepts requests, validates `Authorization: Bearer <token>` header against `JWT_SECRET`, attaches decoded user profile to `req.user`, or rejects with HTTP 401.

---

### 2. Python ML Microservice (`ml-service`)

The Python FastAPI microservice executes mathematical emission calculations, runs XGBoost model predictions, generates SHAP explainability vectors, and builds PDF reports via ReportLab.

#### 📁 `calculator.py`
- `lookup_climatiq_factor(activity_type: str, region: str, unit: str) -> Optional[float]`: Queries external Climatiq API endpoint for real-time localized emission factors if `CLIMATIQ_API_KEY` is present.
- `calculate_item_emission(entry: Dict[str, Any]) -> Tuple[float, int]`: Calculates baseline emissions ($E$) using activity formulas:
  - Road Transport: $E = \text{distance (km)} \times \text{cargo weight (tons)} \times 0.14 \text{ kg CO}_2\text{e/ton-km}$
  - Fuel/Energy/Material: $E = \text{quantity} \times \text{factorValue}$
- `process_calculations(entries: List[Dict[str, Any]]) -> Dict[str, Any]`: Aggregates Scope 1, 2, and 3 emissions, computes category percentage breakdown, and returns formatted calculation payload.

#### 📁 `ml_engine.py`
- `load_model_pipeline()`: Loads pre-trained scikit-learn/XGBoost pipeline (`correction_model.joblib`) from disk.
- `predict_corrected(entries: List[Dict[str, Any]]) -> Dict[str, Any]`: Applies XGBoost regressor pipeline over features (`baselineKg`, `activityType`, `region`, `equipmentAgeYears`, `season`). Includes a rule-based fallback model applying equipment age bias (>10 yrs adds +10-25% emissions), grid region bias (India electricity +15%), and winter diesel heating bias (+20%).
- `explain_predictions(entries: List[Dict[str, Any]]) -> Dict[str, Any]`: Computes feature contributions using **SHAP (`shap.TreeExplainer`)**. Transforms inputs via one-hot encoder and scales vector weights to calculate percentage contribution of each feature towards overall prediction. Includes mathematical feature-importance fallback.

#### 📁 `train_model.py`
- `train_correction_model()`: Generates a synthetic training dataset of 2,000 corporate operational records with multi-factor non-linear emission corruptions. Fits an `XGBRegressor` pipeline using `ColumnTransformer` (OneHotEncoder for categorical features, StandardScaler for numerical features) and exports trained pipeline to `models/correction_model.joblib`. Returns model metrics ($R^2$, MAE, RMSE).

#### 📁 `report_generator.py`
- `generate_pdf_report(payload: Dict[str, Any]) -> str`:
  - **Matplotlib Chart Generation**: Generates 200 DPI transparent PNG charts for emission breakdown pie charts and multi-year trend line graphs.
  - **ReportLab PDF Assembly**: Builds a 2-page formal document including document title, disclaimer callout box, Scope 1/2/3 summary table, visual charts, SHAP AI correction breakdown, dynamic decarbonization recommendations, and regulatory sign-off footer.

#### 📁 `main.py` (FastAPI Router)
- `GET /health`: Health check reporting model directory existence and training state.
- `POST /calculate`: Invokes baseline calculation pipeline.
- `POST /correct`: Invokes XGBoost emission correction model.
- `POST /explain`: Computes SHAP explainability analysis.
- `POST /train`: Retrains XGBoost correction model on demand.
- `POST /whatif`: Executes simulation by scaling activity quantities and calculating projected savings.
- `POST /report`: Generates and streams PDF report file as background task cleanup.

---

### 3. React Frontend Application (`frontend`)

Built with **React 18**, **Vite**, **TypeScript**, **Recharts**, and **Lucide Icons**. Deployed natively to Netlify.

#### 📁 `src/App.tsx`
- `AuthProvider`: Global context managing JWT authentication state, localStorage persistence, login/logout actions, and toast notification popups.
- `MainLayout`: Modern glassmorphic sidebar layout housing logo brand, navigation links, current user profile details, and page container.
- `ProtectedRoute`: Route guard restricting access to unauthenticated users and auto-redirecting to `/login`.
- **Global Axios Interceptor**: Automatically traps HTTP 401/403 responses (expired JWTs) and gracefully clears session storage with a toast alert.

#### 📁 `src/pages/Dashboard.tsx`
- Renders KPI summary cards (Total Footprint, Baseline vs. ML Corrected Delta, Scope Breakdown).
- Interactive Recharts bar and line charts comparing Scope 1/2/3 emissions across reporting periods.
- Renders **SHAP Explainability Progress Cards** detailing feature contribution percentages and human-readable driver descriptions.
- Displays **Google Gemini 1.5 Flash AI Insights Cards** formatted with visual tags (`warning`, `success`, `tip`, `alert`).
- Period switcher dropdown for dynamic historical dataset navigation.

#### 📁 `src/pages/DataEntry.tsx`
- **Manual Data Entry Form**: Interactive form for adding single activity entries (Activity Type, Quantity, Unit, Region, Equipment Age, Cargo Weight, Supplier ID).
- **Drag-and-Drop CSV Ingestion**: Parsed client-side via `PapaParse` with auto-column header mapping and schema validation.
- **Activity Table & Pagination**: Paginated table listing registered activity entries with inline single-click deletion.

#### 📁 `src/pages/WhatIfSimulator.tsx`
- **Multi-Category Decarbonization Sliders**: Interactive percentage reduction controls for Road Transport Freight, Diesel Fuel Combustion, Grid Electricity, and Cotton Raw Materials.
- **Real-Time Calculation**: Calls backend `/simulator/whatif` endpoint to display live projected total emissions and metric tons saved ($t\text{CO}_2\text{e}$).
- **Comparison Visualizer**: Recharts dual-bar chart showing Baseline Footprint vs. Simulated Decarbonization Pathway.

#### 📁 `src/pages/ReportsArchive.tsx`
- **Regulatory Framework Selector**: Choose between **BRSR (India)** and **CSRD (EU)** report formats.
- **PDF Generation Trigger**: Calls `/api/reports` to compile and auto-download presentation-ready PDF report files.
- **Reports Vault**: Table of generated compliance PDF reports stored in MongoDB with direct download links.

#### 📁 `src/pages/Login.tsx`
- Toggle between **Sign In** and **Register Company Account** modes.
- Captures user credentials alongside company metadata (Name, Industry, Country).

---

## 🗄️ Database Schemas & Data Models

| Collection | Model Name | Description & Key Fields |
|------------|------------|--------------------------|
| `users` | `User` | Stores account credentials (`email`, `passwordHash`, `companyId`, `role`). |
| `companies` | `Company` | Corporate entity profile (`name`, `industry`, `country`, `createdAt`). |
| `activityentries` | `ActivityEntry` | Granular activity logs (`companyId`, `period`, `activityType`, `quantity`, `unit`, `region`, `equipmentAgeYears`, `cargoWeightTons`, `supplierId`). |
| `calculationresults` | `CalculationResult` | Calculated totals (`companyId`, `period`, `scope1Kg`, `scope2Kg`, `scope3Kg`, `totalKg`, `baselineTotalKg`, `correctedTotalKg`, `breakdown`, `modelVersion`). |
| `explainabilityresults` | `ExplainabilityResult` | SHAP factor analysis (`calculationResultId`, `topFactors`: `[{ feature, contributionPct, plainLanguage }]`). |
| `reports` | `Report` | PDF report metadata archive (`companyId`, `period`, `format`, `fileName`, `generatedAt`). |
| `whatifscenarios` | `WhatIfScenario` | Saved decarbonization scenario configurations (`companyId`, `scenarioName`, `changes`). |
| `emissionfactors` | `EmissionFactor` | System-wide emission factor definitions (`activityType`, `factorValue`, `unit`, `scope`, `region`). |

---

## 📊 Emission Factors & ML Methodology

### Baseline Standard Factors
- **Grid Electricity (India)**: $0.82 \text{ kg CO}_2\text{e / kWh}$ (Scope 2)
- **Diesel Fuel Combustion**: $2.68 \text{ kg CO}_2\text{e / Litre}$ (Scope 1)
- **Road Freight Transport**: $0.14 \text{ kg CO}_2\text{e / ton-km}$ (Scope 3)
- **Cotton Raw Material Sourcing**: $5.90 \text{ kg CO}_2\text{e / kg}$ (Scope 3)

### ML Correction Logic (XGBoost Regressor)
Standard emission calculations assume linear relationship: $E = Q \times F$.  
In reality, emissions deviate based on physical operating conditions:
$$E_{\text{corrected}} = f_{\text{XGBoost}}(\text{baselineKg}, \text{equipmentAge}, \text{region}, \text{season}, \text{activityType})$$

- **Equipment Aging Effect**: Machinery older than 10 years exhibits a 10% to 25% increase in fuel consumption and thermal losses.
- **Regional Grid Intensity**: Grid loads in developing regions (e.g. India regional coal mix) introduce positive emission uplifts on electricity inputs.
- **Seasonal Weather Variance**: Winter operating conditions increase fuel combustion for industrial heating by +20%.

---

## 🌐 API Endpoints Directory

### Authentication API
| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `POST` | `/api/auth/register` | No | Register new company & admin user |
| `POST` | `/api/auth/login` | No | Authenticate user & receive JWT token |

### Activity Data API
| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `POST` | `/api/activity-entries` | Yes (JWT) | Add single activity log |
| `POST` | `/api/activity-entries/bulk` | Yes (JWT) | Bulk insert parsed CSV activity records |
| `GET` | `/api/activity-entries` | Yes (JWT) | Get paginated activity entries for company |
| `DELETE` | `/api/activity-entries/:id` | Yes (JWT) | Delete activity entry & recalculate |

### Dashboard & Analytics API
| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `GET` | `/api/dashboard/summary?period=YYYY-MM` | Yes (JWT) | Fetch period emission summary & SHAP factors |
| `GET` | `/api/dashboard/trend` | Yes (JWT) | Fetch historical trend data |
| `POST` | `/api/dashboard/seed-apple` | No | Utility endpoint to seed demo corporate dataset |

### Simulation & AI API
| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `POST` | `/api/simulator/whatif` | Yes (JWT) | Calculate what-if scenario savings |
| `GET` | `/api/ai/insights?period=YYYY-MM` | Yes (JWT) | Fetch Google Gemini 1.5 Flash AI insights |

### Compliance Reports API
| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `POST` | `/api/reports` | Yes (JWT) | Generate & download BRSR/CSRD PDF report |
| `GET` | `/api/reports` | Yes (JWT) | List archived PDF compliance reports |
| `GET` | `/api/reports/download/:id` | Yes (JWT) | Download archived PDF report file |

---

## 🚀 Local Development & Deployment Guide

### Prerequisites
- **Node.js**: v20.0+
- **Python**: v3.11+
- **MongoDB**: Local MongoDB instance or MongoDB Atlas Connection String
- **Docker & Docker Compose** *(Optional)*

---

### Option 1: Native Local Setup (3 Terminals)

#### 1️⃣ Terminal 1: Node.js Backend Gateway
```powershell
cd backend-node
copy .env.example .env
# Edit .env with your MONGODB_URI, JWT_SECRET, ML_SERVICE_URL, and GEMINI_API_KEY
npm install
npm run dev
```
*Backend runs on `http://localhost:5000`*

#### 2️⃣ Terminal 2: Python ML Service
```powershell
cd ml-service
python -m venv venv
venv\Scripts\activate   # On Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```
*FastAPI ML Service runs on `http://localhost:8001` (Interactive Swagger Docs at `http://localhost:8001/docs`)*

#### 3️⃣ Terminal 3: React Frontend Application
```powershell
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`*

---

### Option 2: Docker Compose (Single Command)

To run the entire ecosystem (MongoDB, Express Backend, Python ML Service) in isolated containers:

```bash
docker-compose up --build
```

---

### Option 3: Netlify Production Deployment (Frontend)

1. Connect repository to **Netlify** ([app.netlify.com](https://app.netlify.com)).
2. `netlify.toml` automatically configures Vite build command (`npm run build`), publish directory (`frontend/dist`), and SPA routing rules (`/* -> /index.html`).
3. Set the environment variable in Netlify Site Settings:
   - `VITE_API_URL`: `https://your-deployed-backend.com/api`

---

## 🛡️ License & ESG Standard Compliance
Aligned with **GHG Protocol Corporate Standard**, **India BRSR Framework (SEBI)**, and **EU CSRD Standards**. Created for final year academic evaluation and corporate ESG software demonstration.
