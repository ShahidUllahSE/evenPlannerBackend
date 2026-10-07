import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.middleware';
import { getDashboard } from '../services/dashboard.service';
import { listScanLogs, scanTicket } from '../services/scan.service';
import { queryInt, queryString } from '../utils/query';

export const scanController = async (req: Request, res: Response) => {
  const result = await scanTicket(currentUser(req), req.body.eventId, req.body.payload, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(200).json({ success: true, ...result });
};

export const listScanLogsController = async (req: Request, res: Response) => {
  const logs = await listScanLogs(currentUser(req), {
    eventId: queryString(req.query.eventId),
    scannerId: queryString(req.query.scannerId),
    result: queryString(req.query.result),
    page: queryInt(req.query.page, 1),
    limit: queryInt(req.query.limit, 50, 200),
  });
  res.status(200).json({ success: true, ...logs });
};

export const dashboardController = async (req: Request, res: Response) => {
  res.status(200).json({ success: true, ...(await getDashboard(currentUser(req))) });
};
