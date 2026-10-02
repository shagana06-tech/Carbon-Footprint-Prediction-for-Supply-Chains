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
  .connect(MONGO_URI, {
    maxPoolSize: 100, // Maintain up to 100 socket connections
    minPoolSize: 10,  // Keep 10 sockets open by default for instantly faster queries
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  })
  .then(() => logger.info({ message: 'Connected to MongoDB' }))
  .catch((err) => logger.error({ message: 'MongoDB connection error', error: err.message }));

// Start HTTP server (local dev only — Netlify uses serverless-http)
app.listen(PORT, () => {
  logger.info({ message: `Node Server running on port ${PORT}` });
});

export default app;
