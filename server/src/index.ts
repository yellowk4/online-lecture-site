import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true })); // 라우트 정의보다 위에 있어야 한다
app.use(express.json()); // 라우트 정의보다 위에 있어야 한다

app.get('/api/health', (_req, res) => { // 밑줄(_)이 포인트 : 안 쓰는 거 알고 있음, 의도적임, TypeScript/JavaScript의 관례
  res.json({ ok: true });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`server on :${PORT}`);
});