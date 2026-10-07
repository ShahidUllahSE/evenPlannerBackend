import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import routes from './routes';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGINS, credentials: true }));
  // Large enough for a few thousand CSV rows or a long email body.
  app.use(express.json({ limit: '5mb' }));

  app.use('/api', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
