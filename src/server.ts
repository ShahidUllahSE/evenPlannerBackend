import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

const start = async () => {
  await connectDB();
  createApp().listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
