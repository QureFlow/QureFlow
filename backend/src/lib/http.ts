import { Request, Response, NextFunction, RequestHandler } from 'express';
export const route =
  (handler: (req: any, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
