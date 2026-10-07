import mongoose from 'mongoose';
import { env } from './env';

export const connectDB = async (uri = env.MONGO_URI) => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
};
