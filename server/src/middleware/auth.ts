// JWT 로그인한 사람만 통과시키는 검문소
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { fail } from '../lib/errors.js';

export interface AuthedRequest extends Request {
  userId?: number;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return fail(res, 401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { sub: string | number };
    req.userId = Number(payload.sub);
    next();
  } catch {
    return fail(res, 401, 'TOKEN_EXPIRED', '토큰이 만료되었습니다.');
  }
}