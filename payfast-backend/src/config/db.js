import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  console.log('MongoDB connected');
}

/**
 * Runs `work(session)` inside a MongoDB transaction: every write made with the
 * session commits together, or none do. Requires a replica set (Atlas qualifies).
 */
export async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}