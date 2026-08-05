# Carbon Footprint Prediction for Supply Chains

> End-to-end ESG platform that calculates, corrects (via ML), explains (via SHAP), simulates, and reports carbon emissions (Scope 1/2/3) across corporate supply chains.

[![Netlify Status](https://api.netlify.com/api/v1/badges/placeholder/deploy-status)](https://app.netlify.com)

---

## 🚀 Live Demo

The React frontend is deployed on **Netlify**.  
The Node.js backend should be hosted separately (Railway, Render, Fly.io, etc.) and its URL set as `VITE_API_URL` in Netlify's environment variables.

---

## 📁 Project Structure

```
.
├── frontend/          # React 18 + Vite + TypeScript (deployed to Netlify)
├── backend-node/      # Express.js API Gateway  (MongoDB + JWT + ML proxy)
├── ml-service/        # Python FastAPI microservice (XGBoost + SHAP + PDF)
├── netlify.toml       # Netlify build & redirect config
├── docker-compose.yml # Local all-in-one dev environment
└── .env.example       # Environment variable template
```

---

## ⚙️ Netlify Deployment (Frontend)

### 1. Connect your GitHub repo to Netlify
- Import this repo at [app.netlify.com](https://app.netlify.com)
- Netlify auto-detects `netlify.toml` — no manual configuration needed.

### 2. Set the required environment variable
In **Netlify → Site Settings → Environment Variables**, add:

| Variable        | Value                                     |
|-----------------|-------------------------------------------|
| `VITE_API_URL`  | `https://your-backend-url.com/api`        |

> Without `VITE_API_URL`, the frontend falls back to `/api` (works with local dev proxy).

### 3. Deploy
Push to the `main` branch — Netlify auto-builds and deploys.

---

## 💻 Local Development

Ensure **Node.js v20+** and **Python 3.11+** are installed.

### Option A — Manual (Three Terminals)

**Terminal 1 — Express Backend**
```powershell
cd backend-node
copy .env.example .env    # edit MONGODB_URI, JWT_SECRET, etc.
npm install
npm run dev
```
Starts at `http://localhost:5000`

**Terminal 2 — Python ML Service**
```powershell
cd ml-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```
API docs at `http://localhost:8001/docs`

**Terminal 3 — React Frontend**
```powershell
cd frontend
npm install
npm run dev
```
App opens at `http://localhost:5173`

### Option B — Docker Compose
```bash
docker-compose up --build
```
Starts MongoDB, Node Express (port 5000), and FastAPI (port 8001) in one command.

---

## 🧪 Technical Specifications

| Component        | Technology |
|-----------------|------------|
| Frontend        | React 18, Vite, TypeScript, Recharts |
| Backend         | Express.js (Node 20), MongoDB, JWT Auth |
| ML Service      | FastAPI, XGBoost, SHAP, ReportLab |
| Auth            | JWT Bearer tokens, role-based access |
| Deployment      | Netlify (frontend), Docker-ready backend |

### Emission Factors (India Grid)
- **Grid Electricity**: 0.82 kg CO₂e / kWh  
- **Diesel Combustion**: 2.68 kg CO₂e / L  
- **Road Transport**: 0.14 kg CO₂e / ton-km  
- **Cotton Raw Material**: 5.9 kg CO₂e / kg  

### ML & Explainability
- **Model**: XGBoost regressor correcting baseline calculations for equipment age, seasonal temperature variance, and load density  
- **Explainability**: SHAP (Shapley Additive exPlanations) highlights top driving features  
- **Reporting**: ReportLab generates BRSR/CSRD-inspired regulatory PDF summaries
