/**
 * server.ts — Local development entry point only.
 * In production (Netlify), the app is loaded by netlify-functions/api.ts instead.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app, { logger } from './app';

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/carbon_footprint';

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => logger.info({ message: 'Connected to MongoDB' }))
  .catch((err) => logger.error({ message: 'MongoDB connection error', error: err.message }));

// Start HTTP server (local dev only — Netlify uses serverless-http)
app.listen(PORT, () => {
  logger.info({ message: `Node Server running on port ${PORT}` });
});

export default app;
