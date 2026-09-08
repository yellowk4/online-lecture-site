import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import authRouter from './routes/auth.js';
import coursesRouter from './routes/courses.js'; // /api/courses?page=1&size=10
import enrollmentsRouter from './routes/enrollments.js'; // /api/enrollments

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true })); // 라우트 정의보다 위에 있어야 한다
app.use(express.json()); // 라우트 정의보다 위에 있어야 한다
app.use(cookieParser()); // req.cookies를 채워준다 — 없으면 /refresh에서 쿠키를 못 읽음

app.use('/api/auth', authRouter); // /api/auth/signup, /login, /refresh, /logout

app.use('/api/courses', coursesRouter); // /api/courses?page=1&size=10

app.use('/api/enrollments', enrollmentsRouter); // /api/enrollments

app.get('/api/health', (_req, res) => {
  // 밑줄(_)이 포인트 : 안 쓰는 거 알고 있음, 의도적임, TypeScript/JavaScript의 관례
  res.json({ ok: true });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`server on :${PORT}`);
});
