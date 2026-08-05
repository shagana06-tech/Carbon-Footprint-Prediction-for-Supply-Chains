import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    companyId: string;
    role: 'admin' | 'member';
  };
}

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Bearer <token>
    const secret = process.env.JWT_SECRET || 'supersecret_carbon_key_final_year';

    jwt.verify(token, secret, (err: any, user: any) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden', detail: 'Token verification failed' });
      }

      req.user = user as AuthenticatedRequest['user'];
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized', detail: 'Authorization header is missing' });
  }
};
