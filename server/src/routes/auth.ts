import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs'; // 비밀번호 해싱 라이브러리
import jwt from 'jsonwebtoken';
import { z } from 'zod'; // 데이터 유효성 검증 라이브러리
import { prisma } from '../lib/prisma.js';
import { fail } from '../lib/errors.js';

const router = Router();

const ACCESS_TTL = '1h'; // TTL: Time To Live, 만료 시간, 유효 기간
const REFRESH_TTL_DAYS = 14; // 진실의 원천: 여기만 고치면 아래 둘 다 따라온다
const REFRESH_TTL = `${REFRESH_TTL_DAYS}d`; // jwt용 문자열 → '14d'
const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000; // 쿠키용 밀리초 숫자

function issueTokens(userId: number) {
  const accessToken = jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: REFRESH_TTL });
  return { accessToken, refreshToken };
}

function setRefreshCookie(res: Response, token: string) { // any 타입 => Response 타입으로 변경
  res.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: 'lax', // CSRF 공격 방지, 다른 사이트에서 쿠키를 못 읽게 막음
    secure: process.env.NODE_ENV === 'production', // https만 허용, 개발 환경에서는 http도 허용
    maxAge: REFRESH_TTL_MS,
    path: '/api/auth',
  });
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(10, '비밀번호는 10자 이상이어야 합니다')
    .regex(/[!@#$%^&*(),.?":{}|<>_\-\[\]\\\/~`+=;']/, '특수문자를 1자 이상 포함해야 합니다'),
  name: z.string().min(1),
});

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다');

  const { email, password, name } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return fail(res, 409, 'EMAIL_TAKEN', '이미 가입된 이메일입니다.');

  const user = await prisma.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 10) }, //10은 saltRounds, 즉 해시를 몇 번 반복할지 결정, 높을수록 안전하지만 느려짐
  });

  const { accessToken, refreshToken } = issueTokens(user.id);
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ accessToken, user: { id: user.id, email, name } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user || !(await bcrypt.compare(password ?? '', user.passwordHash))) {
    return fail(res, 401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  const { accessToken, refreshToken } = issueTokens(user.id);
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
});

router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return fail(res, 401, 'NO_REFRESH_TOKEN', '다시 로그인해주세요.');
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { sub: string | number };
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user) return fail(res, 401, 'USER_NOT_FOUND', '다시 로그인해주세요.');
    const { accessToken, refreshToken } = issueTokens(user.id);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
  } catch {
    return fail(res, 401, 'INVALID_REFRESH_TOKEN', '다시 로그인해주세요.');
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('refresh_token', { path: '/api/auth' });
  res.json({ ok: true });
});

export default router;