# 1주차 — 뼈대와 인증 (10시간)

> **완료 기준**: 로그인하면 보호된 페이지에 진입 가능

## 시간 배분

| 작업 | 시간 |
|---|---|
| 1. 폴더 구조 + 서버/클라이언트 초기화 | 2h |
| 2. Prisma 스키마 + 마이그레이션 + 시드 | 2h |
| 3. 회원가입/로그인 API + JWT 미들웨어 | 3h |
| 4. FE 로그인 화면 + 토큰 저장 + 라우팅 가드 | 3h |

---

## 1. 폴더 구조 (2h)

모노레포 없이 **폴더 2개로 분리**가 가장 단순합니다. pnpm workspace, turborepo 등은 쓰지 않습니다.

```
online-lecture-site/
├── client/          # React + Vite
├── server/          # Express
└── docs/
```

### 서버 초기화

```bash
mkdir server && cd server && npm init -y
```

```bash
npm i express cors dotenv bcryptjs jsonwebtoken zod
```

```bash
npm i -D typescript tsx @types/express @types/cors @types/bcryptjs @types/jsonwebtoken prisma
```

```bash
npx tsc --init --target es2022 --module nodenext --moduleResolution nodenext --outDir dist --strict
```

`server/package.json` 에 스크립트 추가:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

서버 뼈대 `server/src/index.ts`:

```ts
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`server on :${port}`));
```

`server/.env`:

```
DATABASE_URL="postgresql://<사용자명>@localhost:5432/lecture_site"
JWT_SECRET="아무거나-길게-랜덤-문자열"
JWT_REFRESH_SECRET="다른-랜덤-문자열"
PORT=4000
```

**확인**: `npm run dev` 후 브라우저에서 `http://localhost:4000/api/health` → `{"ok":true}` 나오면 통과.

### 클라이언트 초기화

프로젝트 루트에서:

```bash
npm create vite@latest client -- --template react-ts
```

```bash
cd client && npm i && npm i @tanstack/react-query zustand react-router-dom axios
```

Tailwind + shadcn/ui:

```bash
npm i tailwindcss @tailwindcss/vite
```

`vite.config.ts` 에 tailwind 플러그인과 **API 프록시**를 추가합니다. 프록시를 쓰면 CORS 문제가 개발 중에 사라집니다:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
```

`src/index.css` 맨 위에:

```css
@import "tailwindcss";
```

shadcn/ui는 지금 셋업만 (`npx shadcn@latest init`), 컴포넌트는 필요할 때 하나씩 추가.

**확인**: `npm run dev` 후 `http://localhost:5173` 이 뜨고, 브라우저 콘솔에서 `fetch('/api/health').then(r=>r.json()).then(console.log)` 가 `{ok:true}` 를 찍으면 통과. (프록시 동작 확인)

여기서 커밋: `week1: scaffold client + server`

---

## 2. Prisma 스키마 + 시드 (2h)

```bash
cd server && npx prisma init
```

`server/prisma/schema.prisma` 전체를 아래로 교체:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           Int          @id @default(autoincrement())
  email        String       @unique
  passwordHash String       @map("password_hash")
  name         String
  role         String       @default("student") // student | admin
  enrollments  Enrollment[]
  progresses   Progress[]
  createdAt    DateTime     @default(now()) @map("created_at")

  @@map("users")
}

model Course {
  id          Int          @id @default(autoincrement())
  title       String
  description String
  thumbnail   String
  instructor  String
  lectures    Lecture[]
  enrollments Enrollment[]
  createdAt   DateTime     @default(now()) @map("created_at")

  @@map("courses")
}

model Lecture {
  id         Int        @id @default(autoincrement())
  courseId   Int        @map("course_id")
  course     Course     @relation(fields: [courseId], references: [id])
  title      String
  duration   Int // 초 단위
  videoUrl   String     @map("video_url")
  order      Int // 10, 20, 30... 띄워서 저장
  progresses Progress[]

  @@map("lectures")
}

model Enrollment {
  id        Int       @id @default(autoincrement())
  userId    Int       @map("user_id")
  user      User      @relation(fields: [userId], references: [id])
  courseId  Int       @map("course_id")
  course    Course    @relation(fields: [courseId], references: [id])
  createdAt DateTime  @default(now()) @map("created_at")
  expiresAt DateTime? @map("expires_at") // null = 무제한

  @@unique([userId, courseId])
  @@map("enrollments")
}

model Progress {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  user      User     @relation(fields: [userId], references: [id])
  lectureId Int      @map("lecture_id")
  lecture   Lecture  @relation(fields: [lectureId], references: [id])
  position  Int      @default(0) // 초 단위, 마지막 재생 위치
  completed Boolean  @default(false)
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([userId, lectureId])
  @@map("progresses")
}
```

**핵심 포인트 2개**:
- `Enrollment`에 `@@unique([userId, courseId])` — 같은 강의 중복 신청 방지를 DB가 보장
- `Progress`에 `@@unique([userId, lectureId])` — 4주차에 upsert의 기반이 됨

마이그레이션:

```bash
npx prisma migrate dev --name init
```

### 시드 데이터

`server/prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const HLS_SAMPLES = [
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
];

async function main() {
  for (let c = 1; c <= 2; c++) {
    const course = await prisma.course.create({
      data: {
        title: `샘플 강의 코스 ${c}`,
        description: `코스 ${c}에 대한 설명입니다. 5개의 강의로 구성되어 있습니다.`,
        thumbnail: `https://picsum.photos/seed/course${c}/640/360`,
        instructor: `강사 ${c}`,
      },
    });
    for (let l = 1; l <= 5; l++) {
      await prisma.lecture.create({
        data: {
          courseId: course.id,
          title: `${l}강 - 샘플 강의`,
          duration: 600, // 10분
          videoUrl: HLS_SAMPLES[(l - 1) % HLS_SAMPLES.length],
          order: l * 10,
        },
      });
    }
  }
  console.log('seed done');
}

main().finally(() => prisma.$disconnect());
```

`server/package.json` 에 추가:

```json
{
  "prisma": { "seed": "tsx prisma/seed.ts" }
}
```

```bash
npx prisma db seed
```

**확인**: `npx prisma studio` 로 브라우저에서 courses 2개, lectures 10개 보이면 통과.

커밋: `week1: prisma schema + seed`

---

## 3. 인증 API (3h)

### 파일 구조

```
server/src/
├── index.ts
├── lib/
│   ├── prisma.ts      # PrismaClient 싱글턴
│   └── errors.ts      # 에러 응답 헬퍼
├── middleware/
│   └── auth.ts        # JWT 검증 미들웨어
└── routes/
    └── auth.ts        # /api/auth/*
```

`src/lib/prisma.ts`:

```ts
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
```

`src/lib/errors.ts` — **에러 응답 형식을 여기서 통일**합니다:

```ts
import type { Response } from 'express';

export function fail(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ code, message, status });
}
```

### 토큰 전략 (단순하게)

- **Access Token**: 유효기간 1시간. 응답 body로 내려주고 FE가 메모리(Zustand)에 보관.
- **Refresh Token**: 유효기간 14일. `httpOnly` 쿠키로 내려줌. `/api/auth/refresh` 에서만 사용.

> **왜 이렇게?** access를 localStorage에 두면 XSS에 통째로 털리고, 메모리에만 두면 새로고침 시 로그아웃됩니다. "메모리 access + 쿠키 refresh" 조합이면 새로고침 시 refresh로 access를 재발급받아 세션이 유지됩니다.

쿠키 파싱용 패키지:

```bash
npm i cookie-parser && npm i -D @types/cookie-parser
```

`src/routes/auth.ts`:

```ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { fail } from '../lib/errors.js';

const router = Router();

const ACCESS_TTL = '1h';
const REFRESH_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function issueTokens(userId: number) {
  const accessToken = jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '14d' });
  return { accessToken, refreshToken };
}

function setRefreshCookie(res: any, token: string) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFRESH_TTL_MS,
    path: '/api/auth',
  });
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, 'INVALID_INPUT', parsed.error.issues[0].message);

  const { email, password, name } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return fail(res, 409, 'EMAIL_TAKEN', '이미 가입된 이메일입니다.');

  const user = await prisma.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 10) },
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
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { sub: number };
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
```

`src/middleware/auth.ts`:

```ts
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
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { sub: number };
    req.userId = Number(payload.sub);
    next();
  } catch {
    return fail(res, 401, 'TOKEN_EXPIRED', '토큰이 만료되었습니다.');
  }
}
```

`src/index.ts` 에 연결:

```ts
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';

app.use(cookieParser());
app.use('/api/auth', authRouter);
```

### 확인 (curl로 FE 없이 먼저 검증)

```bash
curl -s -X POST http://localhost:4000/api/auth/signup -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"password123","name":"테스터"}'
```

```bash
curl -s -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"password123"}'
```

`accessToken` 이 응답에 있으면 통과. 틀린 비밀번호로 401이 나오는지도 확인.

커밋: `week1: auth api`

---

## 4. FE 로그인 화면 + 라우팅 가드 (3h)

### 파일 구조

```
client/src/
├── main.tsx
├── App.tsx              # 라우터 정의
├── api/
│   └── client.ts        # axios 인스턴스 (토큰 자동 첨부 + 401 시 refresh)
├── stores/
│   └── auth.ts          # Zustand: accessToken, user
├── pages/
│   ├── LoginPage.tsx
│   ├── SignupPage.tsx
│   └── HomePage.tsx     # 보호된 페이지 (일단 빈 화면)
└── components/
    └── RequireAuth.tsx  # 라우팅 가드
```

`src/stores/auth.ts`:

```ts
import { create } from 'zustand';

interface User { id: number; email: string; name: string }

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
}));
```

`src/api/client.ts` — 요청마다 토큰 첨부, 401이면 refresh 한 번 시도:

```ts
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  try {
    const { data } = await axios.post('/api/auth/refresh');
    useAuthStore.getState().setAuth(data.accessToken, data.user);
    return data.accessToken;
  } catch {
    useAuthStore.getState().clear();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retried) {
      original._retried = true;
      refreshing ??= tryRefresh().finally(() => (refreshing = null));
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);
```

`src/components/RequireAuth.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export default function RequireAuth() {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

`src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import HomePage from './pages/HomePage';
import RequireAuth from './components/RequireAuth';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<HomePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

`src/pages/LoginPage.tsx` (핵심 로직만 — 스타일은 Tailwind로 적당히):

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.accessToken, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.code === 'INVALID_CREDENTIALS'
        ? '이메일 또는 비밀번호를 확인해주세요.'
        : '로그인에 실패했습니다.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={onSubmit} className="w-80 space-y-4">
        <h1 className="text-2xl font-bold">로그인</h1>
        <input className="w-full rounded border p-2" type="email" placeholder="이메일"
               value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded border p-2" type="password" placeholder="비밀번호"
               value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button className="w-full rounded bg-black p-2 text-white">로그인</button>
        <Link to="/signup" className="block text-center text-sm text-gray-500">회원가입</Link>
      </form>
    </div>
  );
}
```

`SignupPage.tsx` 는 LoginPage와 거의 같고 `name` 필드와 `/auth/signup` 호출만 다릅니다. `HomePage.tsx` 는 일단 `<h1>내 강의실 (준비 중)</h1>` 수준이면 충분.

### 새로고침 시 세션 유지

`main.tsx` 렌더 전에 refresh 한 번 시도:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import App from './App';
import { useAuthStore } from './stores/auth';
import './index.css';

axios.post('/api/auth/refresh')
  .then(({ data }) => useAuthStore.getState().setAuth(data.accessToken, data.user))
  .catch(() => {})
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode><App /></StrictMode>,
    );
  });
```

> 렌더를 refresh 완료까지 미루는 가장 단순한 방식입니다. 로딩 스피너를 띄우는 개선은 5주차에.

---

## 1주차 완료 기준 검증

1. 비로그인 상태에서 `http://localhost:5173/` 접근 → `/login` 으로 튕김
2. 회원가입 → 자동 로그인 → `/` 진입
3. **새로고침해도 로그인 유지** (refresh 쿠키 동작)
4. 틀린 비밀번호 → 에러 문구 표시

4개 모두 되면 커밋: `week1: auth complete` → [2주차](week2-courses.md)로.

## 자주 막히는 곳

| 증상 | 원인 |
|---|---|
| FE에서 API 호출 시 404 | vite proxy 설정 누락, 또는 서버가 안 떠 있음 |
| refresh 쿠키가 안 붙음 | `cookie-parser` 미들웨어 등록 누락, 또는 axios 기본 인스턴스(`axios.post`)가 아닌 곳에서 쿠키 경로 불일치 |
| `PrismaClientInitializationError` | PostgreSQL이 꺼져 있음 → `brew services start postgresql@16` |
| JWT `invalid signature` | `.env` 수정 후 서버 재시작 안 함 |
