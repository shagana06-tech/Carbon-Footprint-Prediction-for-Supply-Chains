import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import winston from 'winston';

import router from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

// Setup winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  next();
});

// Register API Routes
app.use('/api', router);

// Basic MongoDB Connection
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/carbon_footprint';
mongoose.connect(MONGO_URI)
  .then(() => logger.info({ message: 'Connected to MongoDB' }))
  .catch((err) => logger.error({ message: 'MongoDB connection error', error: err.message }));

// Health Check Endpoint
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
    database: {
      status: dbStatus,
      uri: MONGO_URI.replace(/:([^:@]+)@/, ':***@') // mask password in log/health
    },
    mlService: {
      status: mlStatus,
      url: ML_SERVICE_URL,
      detail: mlDetail
    }
  });
});

// Centralized error handling middleware
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

app.listen(PORT, () => {
  logger.info({ message: `Node Server running on port ${PORT}` });
});

export default app;
