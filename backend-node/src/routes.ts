import { Router } from 'express';
import { register, login } from './controllers/auth.controller';
import { 
  createActivityEntry, 
  bulkUploadCSV, 
  getActivityEntries, 
  deleteActivityEntry 
} from './controllers/activity.controller';
import { 
  getDashboardSummary, 
  getDashboardTrend,
  seedAppleDemoData
} from './controllers/dashboard.controller';
import { runWhatIfSimulation } from './controllers/simulator.controller';
import { 
  generateReport, 
  getReportsList, 
  downloadReportFile 
} from './controllers/report.controller';
import { 
  getPredictionHistory, 
  getPredictionLogById, 
  deletePredictionLog, 
  seedUserCompanyData 
} from './controllers/history.controller';
import { getAiInsights } from './controllers/ai.controller';
import { authenticateJWT } from './middleware/auth.middleware';

const router = Router();

// Public Authentication Routes
router.post('/auth/register', register);
router.post('/auth/login', login);

// Activity Entry CRUD (Authenticated)
router.post('/activity-entries', authenticateJWT, createActivityEntry);
router.post('/activity-entries/bulk', authenticateJWT, bulkUploadCSV);
router.get('/activity-entries', authenticateJWT, getActivityEntries);
router.delete('/activity-entries/:id', authenticateJWT, deleteActivityEntry);

// Dashboard Data Endpoints (Authenticated)
router.get('/dashboard/summary', authenticateJWT, getDashboardSummary);
router.get('/dashboard/trend', authenticateJWT, getDashboardTrend);
router.post('/dashboard/seed-apple', seedAppleDemoData); // Public endpoint for seeding utility

// Simulator (Authenticated)
router.post('/simulator/whatif', authenticateJWT, runWhatIfSimulation);

// Reports (Authenticated)
router.post('/reports', authenticateJWT, generateReport);
router.get('/reports', authenticateJWT, getReportsList);
router.get('/reports/download/:id', authenticateJWT, downloadReportFile);

// AI Insights powered by Gemini (Authenticated)
router.get('/ai/insights', authenticateJWT, getAiInsights);

// Prediction History & Pre-Prediction Audit Logs (Authenticated)
router.get('/history', authenticateJWT, getPredictionHistory);
router.get('/history/:id', authenticateJWT, getPredictionLogById);
router.delete('/history/:id', authenticateJWT, deletePredictionLog);
router.post('/history/seed-my-company', authenticateJWT, seedUserCompanyData);

export default router;

