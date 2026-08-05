/**
 * api.ts — Netlify Serverless Function
 *
 * Wraps the Express app with serverless-http so every /api/* request
 * is handled by the same Express router, just without a persistent port.
 *
 * Connection pooling: mongoose.connect() is called once outside the handler
 * and reused across warm Lambda invocations (Netlify/AWS Lambda behaviour).
 */
import serverless from 'serverless-http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app, { logger } from '../src/app';

// Load env vars — Netlify injects them at build/runtime, dotenv is a safety net
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || '';

// ─── MongoDB Connection Cache ─────────────────────────────────────────────────
// Re-use the connection across warm invocations to avoid reconnection latency.
let isConnected = false;

const connectDB = async (): Promise<void> => {
  if (isConnected && mongoose.connection.readyState === 1) return;

  if (!MONGO_URI) {
    logger.error({ message: 'MONGODB_URI environment variable is not set' });
    throw new Error('MONGODB_URI is not configured');
  }

  await mongoose.connect(MONGO_URI);
  isConnected = true;
  logger.info({ message: 'Serverless: MongoDB connected' });
};

// ─── Serverless Handler ───────────────────────────────────────────────────────
const serverlessHandler = serverless(app);

export const handler = async (event: any, context: any) => {
  // Tell Lambda not to wait for the event loop to drain before returning.
  // Critical for keeping MongoDB connections alive across warm invocations.
  context.callbackWaitsForEmptyEventLoop = false;

  await connectDB();
  return serverlessHandler(event, context);
};
