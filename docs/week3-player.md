# 3주차 — 플레이어 (10시간, 가장 중요한 주)

> **완료 기준**: 강의를 클릭하면 영상이 재생되고 다음 강의로 넘어감

## 시간 배분

| 작업 | 시간 |
|---|---|
| 1. playback API (권한 검증 + Signed URL) | 3h |
| 2. FE: 플레이어 붙이기 + HLS 재생 확인 | 3h |
| 3. FE: 사이드바 커리큘럼 + 강의 전환 | 2.5h |
| 4. 배속/볼륨 기억 + Safari 확인 | 1.5h |

**이번 주의 핵심 규칙**: 플레이어에서 막히면 다른 걸 다 미루고 플레이어를 뚫으세요. 진도 추적(4주차)은 플레이어 없이는 아무것도 아닙니다.

---

## 1. playback API (3h)

### 왜 별도 API인가

- 상세 API에 videoUrl을 넣으면: 비수강자도 개발자도구에서 URL을 복사해 재생 가능
- playback API를 거치면: **매 요청마다** 서버가 enrollment와 만료일을 확인

### 1단계: 권한 검증만 (Signed URL은 2단계)

먼저 "수강자만 URL을 받는다"까지만 만듭니다. `server/src/routes/lectures.ts`:

```ts
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { fail } from '../lib/errors.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/lectures/:id/playback
router.get('/:id/playback', requireAuth, async (req: AuthedRequest, res) => {
  const lectureId = Number(req.params.id);
  if (!Number.isInteger(lectureId)) return fail(res, 400, 'INVALID_ID', '잘못된 요청입니다.');

  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    include: { course: { select: { id: true } } },
  });
  if (!lecture) return fail(res, 404, 'LECTURE_NOT_FOUND', '강의를 찾을 수 없습니다.');

  // 권한은 서버가 최종 판단 — 매 요청마다 확인
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: req.userId!, courseId: lecture.course.id } },
  });
  if (!enrollment) {
    return fail(res, 403, 'ENROLLMENT_REQUIRED', '수강 신청이 필요합니다.');
  }
  if (enrollment.expiresAt && enrollment.expiresAt < new Date()) {
    return fail(res, 403, 'ENROLLMENT_EXPIRED', '수강 기간이 만료되었습니다.');
  }

  res.json({ url: lecture.videoUrl, expiresIn: 600 });
});

export default router;
```

`index.ts` 등록:

```ts
import lecturesRouter from './routes/lectures.js';
app.use('/api/lectures', lecturesRouter);
```

**확인**:

- 수강 신청한 계정 토큰으로 → `url` 이 온다
- 새 계정(신청 안 함)으로 → `ENROLLMENT_REQUIRED` 403
- 토큰 없이 → 401

### 2단계: Signed URL (외부 테스트 스트림을 쓰는 동안은 "형태만")

외부 공개 스트림(mux.dev 등)은 내가 서명을 검증할 수 없으므로, **로컬 정적 서빙으로 전환한 후에** 서명이 의미를 가집니다. 이번 주는 위의 1단계로 충분하고, 아래는 로컬 HLS 파일(week0 옵션 B)을 쓸 때 추가하세요. **이번 주에 시간이 남으면 하고, 아니면 4주차 마지막이나 5주차로 미뤄도 됩니다.**

```ts
import crypto from 'node:crypto';

const SIGN_SECRET = process.env.JWT_SECRET!; // 별도 키를 둬도 됨

export function signVideoPath(path: string, ttlSeconds = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = crypto.createHmac('sha256', SIGN_SECRET).update(`${path}:${exp}`).digest('hex');
  return `${path}?exp=${exp}&sig=${sig}`;
}

export function verifySignature(path: string, exp: string, sig: string) {
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto.createHmac('sha256', SIGN_SECRET).update(`${path}:${exp}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
```

정적 서빙 미들웨어에서 서명 검증 (`index.ts`):

```ts
import path from 'node:path';
import express from 'express';
import { verifySignature } from './lib/sign.js';

app.use('/videos', (req, res, next) => {
  const { exp, sig } = req.query as { exp?: string; sig?: string };
  if (!exp || !sig || !verifySignature(`/videos${req.path}`, exp, sig)) {
    return res.status(403).json({ code: 'INVALID_SIGNATURE', message: '유효하지 않은 URL입니다.', status: 403 });
  }
  next();
}, express.static(path.join(process.cwd(), 'public/videos')));
```

> **알아둘 함정**: m3u8 파일 안의 세그먼트(.ts) 경로에는 서명이 안 붙습니다. 완벽히 하려면 m3u8을 파싱해 세그먼트마다 서명을 붙여야 하지만, **1인 프로젝트에서는 m3u8에만 서명해도 "링크 공유로 뚫림"의 90%는 막힙니다**. README에 한계로 적어두면 그게 오히려 좋은 포트폴리오 포인트.

---

## 2. FE: 플레이어 붙이기 (3h)

### 라이브러리: Vidstack 추천

video.js보다 React 통합이 깔끔하고 HLS를 기본 지원합니다.

```bash
cd client && npm i @vidstack/react hls.js
```

### 재생 페이지 뼈대

`client/src/api/lectures.ts`:

```ts
import { api } from './client';

export async function fetchPlayback(lectureId: number) {
  const { data } = await api.get(`/lectures/${lectureId}/playback`);
  return data as { url: string; expiresIn: number };
}
```

`client/src/pages/LearnPage.tsx` — 이번 주 최소 버전:

```tsx
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { fetchPlayback } from '../api/lectures';

export default function LearnPage() {
  const { lectureId } = useParams();
  const id = Number(lectureId);
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['playback', id],
    queryFn: () => fetchPlayback(id),
    staleTime: 0,          // 만료되는 URL이므로 캐시 재사용 금지
    gcTime: 0,
    retry: false,
  });

  if (isLoading) return <p className="p-8">불러오는 중...</p>;

  if (error) {
    const code = (error as any).response?.data?.code;
    if (code === 'ENROLLMENT_REQUIRED') {
      return (
        <div className="p-8 text-center">
          <p>수강 신청 후 볼 수 있는 강의입니다.</p>
          <button onClick={() => navigate(-1)} className="mt-4 rounded border px-4 py-2">돌아가기</button>
        </div>
      );
    }
    return <p className="p-8">영상을 불러오지 못했습니다.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <MediaPlayer src={data!.url} playsInline>
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    </div>
  );
}
```

라우트 추가 (가드 안쪽):

```tsx
<Route element={<RequireAuth />}>
  <Route path="/learn/:lectureId" element={<LearnPage />} />
</Route>
```

**확인**: 2주차의 "이어서 학습하기" → 영상 재생. 여기까지 되면 커밋: `week3: basic playback`

### Chrome + Safari 둘 다 확인

- **Chrome**: 네이티브 HLS 미지원 → Vidstack이 내부적으로 hls.js를 사용 (자동)
- **Safari**: 네이티브 HLS 지원 → `<video>` 가 직접 재생

둘 다 열어서 재생 확인. Safari에서만 안 되면 대부분 CORS 문제(외부 스트림은 보통 괜찮음), 로컬 서빙이면 서버 정적 라우트에 CORS 헤더가 필요할 수 있습니다.

---

## 3. 사이드바 커리큘럼 + 강의 전환 (2.5h)

재생 페이지 레이아웃을 "플레이어(왼쪽) + 커리큘럼(오른쪽)"으로 확장합니다.

필요한 데이터: 현재 lecture가 속한 코스의 전체 lecture 목록. 가장 단순한 방법은 **playback 응답에 courseId를 추가**하고, 기존 코스 상세 쿼리를 재사용하는 것.

서버 playback 응답 수정:

```ts
res.json({ url: lecture.videoUrl, expiresIn: 600, courseId: lecture.course.id, title: lecture.title });
```

`LearnPage.tsx` 확장:

```tsx
import { fetchCourse } from '../api/courses';
import { Link } from 'react-router-dom';

// LearnPage 컴포넌트 안, playback 쿼리 아래에:
const { data: course } = useQuery({
  queryKey: ['course', data?.courseId],
  queryFn: () => fetchCourse(data!.courseId),
  enabled: !!data?.courseId,
});

// 현재 강의의 다음 강의 계산
const lectures = course?.lectures ?? [];
const currentIndex = lectures.findIndex((l) => l.id === id);
const nextLecture = currentIndex >= 0 ? lectures[currentIndex + 1] : undefined;
```

레이아웃 (return 부분 교체):

```tsx
return (
  <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 lg:flex-row">
    <div className="flex-1">
      <MediaPlayer
        src={data!.url}
        playsInline
        autoPlay
        onEnded={() => nextLecture && navigate(`/learn/${nextLecture.id}`)}
      >
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
      <h1 className="mt-4 text-xl font-bold">{data!.title}</h1>
    </div>

    <aside className="w-full shrink-0 lg:w-80">
      <h2 className="mb-2 font-semibold">커리큘럼</h2>
      <ul className="divide-y rounded-lg border">
        {lectures.map((lec, i) => (
          <li key={lec.id}>
            <Link to={`/learn/${lec.id}`}
                  className={`block p-3 text-sm hover:bg-gray-50 ${lec.id === id ? 'bg-gray-100 font-semibold' : ''}`}>
              {i + 1}. {lec.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  </div>
);
```

**강의 전환 시 주의**: 같은 라우트 컴포넌트에서 파라미터만 바뀌므로, `queryKey: ['playback', id]` 에 id가 들어 있어야 새 강의 URL을 다시 받아옵니다 (위 코드는 이미 그렇게 되어 있음).

**확인**: 사이드바에서 다른 강의 클릭 → 영상 교체. 영상이 끝나면 자동으로 다음 강의로 이동.

---

## 4. 배속/볼륨 기억 (1.5h)

Zustand의 `persist` 미들웨어로 localStorage에 저장합니다. `client/src/stores/player.ts`:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerSettings {
  rate: number;
  volume: number;
  muted: boolean;
  set: (partial: Partial<Omit<PlayerSettings, 'set'>>) => void;
}

export const usePlayerStore = create<PlayerSettings>()(
  persist(
    (set) => ({
      rate: 1,
      volume: 1,
      muted: false,
      set: (partial) => set(partial),
    }),
    { name: 'player-settings' },
  ),
);
```

`MediaPlayer` 에 연결:

```tsx
const { rate, volume, muted, set } = usePlayerStore();

<MediaPlayer
  src={data!.url}
  playsInline
  autoPlay
  playbackRate={rate}
  volume={volume}
  muted={muted}
  onRateChange={(r) => set({ rate: r })}
  onVolumeChange={(d) => set({ volume: d.volume, muted: d.muted })}
  onEnded={() => nextLecture && navigate(`/learn/${nextLecture.id}`)}
>
```

**확인**: 배속을 1.5x로 바꾸고 새로고침 → 여전히 1.5x. 다른 강의로 이동해도 유지.

---

## 3주차 완료 기준 검증

1. 커리큘럼에서 강의 클릭 → 영상 재생 (Chrome, Safari 둘 다)
2. 비수강 강의 접근 → "수강 신청이 필요합니다" 안내
3. 사이드바에서 강의 전환 동작
4. 영상 종료 시 다음 강의 자동 이동
5. 배속/볼륨이 새로고침 후에도 유지

커밋: `week3: player complete` → [4주차](week4-progress.md)로.

## 자주 막히는 곳

| 증상 | 원인 |
|---|---|
| Chrome에서 재생 안 되고 Safari만 됨 | hls.js 미로드 — Vidstack 버전 확인, `npm i hls.js` 됐는지 확인 |
| 강의 전환 시 이전 영상이 계속 나옴 | queryKey에 lecture id 누락으로 캐시 재사용 |
| 자동재생이 안 됨 | 브라우저 정책상 muted가 아니면 autoplay 차단 — 사용자가 한 번 상호작용한 뒤에는 대부분 허용됨. 개발 중엔 무시해도 됨 |
| 403 INVALID_SIGNATURE (로컬 서빙 시) | m3u8은 서명 붙였지만 .ts 세그먼트 요청이 막힘 — 세그먼트 요청은 서명 검증 예외 처리하거나 Referer 기반으로 완화 |
