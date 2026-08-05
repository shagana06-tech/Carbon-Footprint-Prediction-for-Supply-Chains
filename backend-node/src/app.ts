import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import winston from 'winston';

import router from './routes';

dotenv.config();

// ─── Shared Logger ──────────────────────────────────────────────────────────
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

// CORS — accept the configured CLIENT_URL or any Netlify preview URL
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  /\.netlify\.app$/,          // all *.netlify.app previews
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, same-origin Netlify requests)
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    callback(allowed ? null : new Error(`CORS blocked: ${origin}`), allowed);
  },
  credentials: true
}));

app.use(express.json());

// Request logger middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url, ip: req.ip });
  next();
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', router);

// ─── Health Check ────────────────────────────────────────────────────────────
const MONGO_URI_MASKED = (process.env.MONGODB_URI || '').replace(/:([^:@]+)@/, ':***@');

app.get('/health', async (req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  let mlStatus = 'unknown';
  let mlDetail = '';

  try {
    const mlResponse = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 2000 });
    if (mlResponse.status === 200) {
      mlStatus = mlResponse.data.status || 'ok';
    }
  } catch (err: any) {
    mlStatus = 'offline';
    mlDetail = err.message;
  }

  res.status(200).json({
    status: dbStatus === 'connected' && mlStatus === 'ok' ? 'ok' : 'degraded',
    service: 'backend-node',
    database: { status: dbStatus, uri: MONGO_URI_MASKED },
    mlService: { status: mlStatus, url: ML_SERVICE_URL, detail: mlDetail }
  });
});

// ─── Centralized Error Handler ────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({
    message: 'Unhandled Exception',
    error: err.message,
    stack: err.stack
  });
  res.status(500).json({
    error: 'InternalServerError',
    detail: err.message || 'An unexpected error occurred'
  });
});

export default app;
