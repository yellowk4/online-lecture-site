// 에러 응답 형식 통일
import type { Response } from 'express';

export function fail(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ code, message, status });
}