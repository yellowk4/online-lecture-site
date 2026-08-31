# 4주차 — 진도 추적 (10시간)

> **완료 기준**: 껐다 켜도 보던 위치에서 이어짐

## 시간 배분

| 작업 | 시간 |
|---|---|
| 1. PATCH /progress API (멱등 갱신) | 2h |
| 2. FE: throttle 저장 + pause/pagehide 저장 | 3h |
| 3. FE: 진입 시 위치 복원 | 1.5h |
| 4. 사이드바 진도 표시 + 수강률 | 1.5h |
| 5. 내 강의실 페이지 (GET /my/courses) | 2h |

---

## 1. PATCH /progress API (2h)

### 설계 요점 복습

- `position`: 초 단위 정수, **마지막 재생 위치**
- 갱신은 `MAX(기존, 신규)` — 뒤로 감기해도 진도가 후퇴하지 않음
- `completed`: `position >= duration * 0.9` 면 true. **한 번 true면 다시 false로 내리지 않음**
- `@@unique([userId, lectureId])` 덕에 upsert로 처리

### 왜 MAX 인가?

사용자가 10분까지 보고 → 3분 지점으로 되감아 다시 봄 → 이탈. 이때 position이 3분으로 저장되면 "이어보기"가 3분부터 시작되는 게 맞을까요? 정책 나름이지만, **완료 판정이 후퇴하는 것**이 더 큰 문제입니다. 이 프로젝트는 단순하게 MAX로 통일합니다. (되감은 위치에서 이어보고 싶다는 요구는 `later.md`로.)

`server/src/routes/progress.ts`:

```ts
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { fail } from '../lib/errors.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

// PATCH /api/progress/:lectureId  body: { position }
router.patch('/:lectureId', requireAuth, async (req: AuthedRequest, res) => {
  const lectureId = Number(req.params.lectureId);
  const position = Math.floor(Number(req.body?.position));
  if (!Number.isInteger(lectureId) || !Number.isFinite(position) || position < 0) {
    return fail(res, 400, 'INVALID_INPUT', '잘못된 요청입니다.');
  }

  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: { duration: true, courseId: true },
  });
  if (!lecture) return fail(res, 404, 'LECTURE_NOT_FOUND', '강의를 찾을 수 없습니다.');

  // 진도 저장도 수강자만 (권한은 서버가 최종 판단)
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: req.userId!, courseId: lecture.courseId } },
  });
  if (!enrollment) return fail(res, 403, 'ENROLLMENT_REQUIRED', '수강 신청이 필요합니다.');

  const clamped = Math.min(position, lecture.duration);

  const existing = await prisma.progress.findUnique({
    where: { userId_lectureId: { userId: req.userId!, lectureId } },
  });

  const newPosition = Math.max(existing?.position ?? 0, clamped); // 멱등: 항상 MAX
  const completed = (existing?.completed ?? false) || newPosition >= lecture.duration * 0.9;

  const progress = await prisma.progress.upsert({
    where: { userId_lectureId: { userId: req.userId!, lectureId } },
    create: { userId: req.userId!, lectureId, position: newPosition, completed },
    update: { position: newPosition, completed },
  });

  res.json({ position: progress.position, completed: progress.completed });
});

export default router;
```

`index.ts` 등록:

```ts
import progressRouter from './routes/progress.js';
app.use('/api/progress', progressRouter);
```

### sendBeacon 대비 — Content-Type 처리

`navigator.sendBeacon` 은 커스텀 헤더를 못 붙입니다. 문자열을 보내면 `text/plain` 으로 갑니다. Express의 `express.json()` 은 이를 파싱하지 않으므로 **text/plain도 JSON으로 파싱**하도록 `index.ts` 를 보강하세요:

```ts
app.use(express.json({ type: ['application/json', 'text/plain'] }));
```

또 sendBeacon은 Authorization 헤더도 못 붙입니다. 해결책은 **URL 쿼리로 토큰을 받는 경로를 하나 열어주는 것** — 단, 이 방식은 토큰이 서버 로그에 남을 수 있어 진도 저장 전용으로만 씁니다. `requireAuth` 를 살짝 보강:

```ts
// middleware/auth.ts 의 requireAuth 에서, header 검사 전에:
const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
const raw = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;
if (!raw) return fail(res, 401, 'UNAUTHORIZED', '로그인이 필요합니다.');
// 이후 jwt.verify(raw, ...) 로 동일
```

**확인**:

```bash
# TOKEN은 로그인해서 받은 값
curl -s -X PATCH "http://localhost:4000/api/progress/1" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"position":120}'
```

- `{"position":120,"completed":false}` 응답
- 이어서 `{"position":60}` 을 보내도 → position은 **120 유지** (MAX 동작)
- `{"position":580}` (600초의 90% 이상) → `completed: true`

3가지 확인 후 커밋: `week4: progress api`

---

## 2. FE: 저장 트리거 3종 (3h)

저장이 일어나야 하는 순간은 정확히 3개입니다:

| 트리거 | 이유 | 구현 |
|---|---|---|
| 재생 중 15초마다 | 갑작스러운 크래시 대비 | `timeupdate` + throttle |
| 일시정지 순간 | 사용자가 멈춘 정확한 위치 | `pause` 이벤트 |
| 페이지 이탈 | 탭 닫기/이동 | `pagehide` + `sendBeacon` |

`client/src/api/progress.ts`:

```ts
import { api } from './client';
import { useAuthStore } from '../stores/auth';

export async function saveProgress(lectureId: number, position: number) {
  const { data } = await api.patch(`/progress/${lectureId}`, { position: Math.floor(position) });
  return data as { position: number; completed: boolean };
}

// 이탈 시 전용 — sendBeacon은 헤더를 못 붙이므로 쿼리 토큰 사용
export function beaconProgress(lectureId: number, position: number) {
  const token = useAuthStore.getState().accessToken;
  if (!token) return;
  navigator.sendBeacon(
    `/api/progress/${lectureId}?token=${encodeURIComponent(token)}`,
    JSON.stringify({ position: Math.floor(position), _method: 'PATCH' }),
  );
}
```

> **주의**: sendBeacon은 POST만 보냅니다. 서버 라우트에 PATCH와 동일한 핸들러를 POST로도 열어주세요:
>
> ```ts
> // routes/progress.ts — 핸들러를 함수로 빼서 둘 다 등록
> router.patch('/:lectureId', requireAuth, saveProgressHandler);
> router.post('/:lectureId', requireAuth, saveProgressHandler);
> ```

### LearnPage에 연결

Vidstack은 player ref로 currentTime에 접근합니다:

```tsx
import { useEffect, useRef } from 'react';
import type { MediaPlayerInstance } from '@vidstack/react';
import { saveProgress, beaconProgress } from '../api/progress';

// LearnPage 컴포넌트 안:
const playerRef = useRef<MediaPlayerInstance>(null);
const lastSavedAt = useRef(0);

// 15초 throttle 저장 (lodash 없이 직접)
function onTimeUpdate() {
  const now = Date.now();
  if (now - lastSavedAt.current < 15000) return;
  lastSavedAt.current = now;
  const t = playerRef.current?.currentTime ?? 0;
  if (t > 0) saveProgress(id, t).catch(() => {}); // 저장 실패는 조용히 무시 (다음 주기에 재시도됨)
}

function onPause() {
  const t = playerRef.current?.currentTime ?? 0;
  if (t > 0) saveProgress(id, t).catch(() => {});
}

// 페이지 이탈 시 저장
useEffect(() => {
  function onPageHide() {
    const t = playerRef.current?.currentTime ?? 0;
    if (t > 0) beaconProgress(id, t);
  }
  window.addEventListener('pagehide', onPageHide);
  return () => window.removeEventListener('pagehide', onPageHide);
}, [id]);

// 강의 전환(SPA 내 이동) 시에도 저장 — 언마운트/id 변경 시점
useEffect(() => {
  return () => {
    const t = playerRef.current?.currentTime ?? 0;
    if (t > 0) saveProgress(id, t).catch(() => {});
  };
}, [id]);
```

```tsx
<MediaPlayer
  ref={playerRef}
  src={data!.url}
  onTimeUpdate={onTimeUpdate}
  onPause={onPause}
  /* ...기존 props... */
>
```

> **pagehide vs beforeunload**: `beforeunload` 는 모바일 Safari에서 안 불리는 경우가 많습니다. `pagehide` 가 모바일 포함 가장 안정적. SPA 내 라우트 이동은 pagehide가 안 불리므로 위의 cleanup effect가 따로 필요합니다.

**확인**: 영상을 재생하고 Network 탭을 보면 15초에 한 번씩만 PATCH가 나감. 일시정지 → 즉시 PATCH. 탭 닫기 → (Network 탭 Preserve log 켜고) beacon 요청 확인. `timeupdate` 가 초당 수십 번 발생해도 요청은 15초당 1건이어야 합니다.

---

## 3. 진입 시 위치 복원 (1.5h)

playback API가 저장된 진도를 함께 내려주게 하는 것이 가장 간단합니다. `routes/lectures.ts` 의 playback 핸들러 끝부분:

```ts
const progress = await prisma.progress.findUnique({
  where: { userId_lectureId: { userId: req.userId!, lectureId } },
});

res.json({
  url: lecture.videoUrl,
  expiresIn: 600,
  courseId: lecture.course.id,
  title: lecture.title,
  resumePosition: progress && !progress.completed ? progress.position : 0,
  // 완료한 강의는 처음부터 (거의 끝 지점에서 시작하면 이상하므로)
});
```

FE에서 플레이어가 준비되면 이동:

```tsx
<MediaPlayer
  ref={playerRef}
  src={data!.url}
  onCanPlay={() => {
    const resume = data!.resumePosition;
    if (resume > 5 && playerRef.current) {
      playerRef.current.currentTime = resume;
    }
  }}
  /* ... */
>
```

> `resume > 5` — 5초 미만이면 그냥 처음부터. 1~2초 지점 복원은 사용자에게 혼란만 줍니다.

**확인**: 영상을 2분쯤 보고 탭을 닫는다 → 다시 그 강의에 들어가면 2분 지점부터 재생. **이게 이 프로젝트의 핵심 데모입니다.**

커밋: `week4: resume playback`

---

## 4. 사이드바 진도 표시 + 수강률 (1.5h)

코스 상세 API에 (로그인 사용자라면) 진도를 포함시킵니다. `routes/courses.ts` 상세 핸들러에서 `enrolled` 계산 아래에 추가:

```ts
let progressMap: Record<number, { position: number; completed: boolean }> = {};
if (userId && enrolled) {
  const progresses = await prisma.progress.findMany({
    where: { userId, lecture: { courseId: id } },
  });
  progressMap = Object.fromEntries(
    progresses.map((p) => [p.lectureId, { position: p.position, completed: p.completed }]),
  );
}

res.json({
  ...course,
  enrolled,
  lectures: course.lectures.map((l) => ({
    ...l,
    progress: progressMap[l.id] ?? { position: 0, completed: false },
  })),
});
```

FE 타입에 반영 (`api/courses.ts`):

```ts
export interface LectureSummary {
  id: number;
  title: string;
  duration: number;
  order: number;
  progress: { position: number; completed: boolean };
}
```

사이드바에 표시 (`LearnPage.tsx` 커리큘럼 항목):

```tsx
<Link to={`/learn/${lec.id}`} className={/* 기존 */}>
  <span className="flex items-center gap-2">
    {lec.progress.completed ? '✅' : '▶️'} {i + 1}. {lec.title}
  </span>
  {!lec.progress.completed && lec.progress.position > 0 && (
    <div className="mt-1 h-1 w-full rounded bg-gray-200">
      <div className="h-1 rounded bg-blue-500"
           style={{ width: `${Math.min(100, (lec.progress.position / lec.duration) * 100)}%` }} />
    </div>
  )}
</Link>
```

수강률은 `완료 강의 수 / 전체 강의 수`:

```tsx
const completedCount = lectures.filter((l) => l.progress.completed).length;
const percent = lectures.length ? Math.round((completedCount / lectures.length) * 100) : 0;
// 사이드바 상단에: <p>수강률 {percent}% ({completedCount}/{lectures.length})</p>
```

> **캐시 주의**: 진도를 저장해도 코스 상세 쿼리 캐시는 옛날 값입니다. 강의 전환 시 최신 진도가 보이게 `saveProgress` 성공 후 `queryClient.invalidateQueries({ queryKey: ['course'] })` 를 호출하거나, 간단히 코스 쿼리에 `staleTime: 0` 을 두세요.

---

## 5. 내 강의실 (2h)

`server/src/routes/my.ts`:

```ts
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/my/courses
router.get('/courses', requireAuth, async (req: AuthedRequest, res) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    include: {
      course: {
        include: {
          lectures: { select: { id: true, duration: true }, orderBy: { order: 'asc' } },
        },
      },
    },
  });

  const lectureIds = enrollments.flatMap((e) => e.course.lectures.map((l) => l.id));
  const progresses = await prisma.progress.findMany({
    where: { userId: req.userId!, lectureId: { in: lectureIds } },
  });
  const progressByLecture = new Map(progresses.map((p) => [p.lectureId, p]));

  res.json({
    items: enrollments.map((e) => {
      const lectures = e.course.lectures;
      const completed = lectures.filter((l) => progressByLecture.get(l.id)?.completed).length;
      // 이어보기 대상: 미완료 강의 중 첫 번째 (진행 중인 게 있으면 그것)
      const inProgress = lectures.find((l) => {
        const p = progressByLecture.get(l.id);
        return p && !p.completed && p.position > 0;
      });
      const firstIncomplete = lectures.find((l) => !progressByLecture.get(l.id)?.completed);
      const resumeLectureId = (inProgress ?? firstIncomplete ?? lectures[0])?.id ?? null;

      return {
        courseId: e.courseId,
        title: e.course.title,
        thumbnail: e.course.thumbnail,
        instructor: e.course.instructor,
        totalLectures: lectures.length,
        completedLectures: completed,
        percent: lectures.length ? Math.round((completed / lectures.length) * 100) : 0,
        resumeLectureId,
        enrolledAt: e.createdAt,
      };
    }),
  });
});

export default router;
```

`index.ts` 등록:

```ts
import myRouter from './routes/my.js';
app.use('/api/my', myRouter);
```

FE `client/src/pages/MyCoursesPage.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface MyCourse {
  courseId: number; title: string; thumbnail: string; instructor: string;
  totalLectures: number; completedLectures: number; percent: number;
  resumeLectureId: number | null;
}

export default function MyCoursesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-courses'],
    queryFn: async () => (await api.get('/my/courses')).data as { items: MyCourse[] },
  });

  if (isLoading) return <p className="p-8">불러오는 중...</p>;
  if (!data?.items.length) {
    return (
      <div className="p-8 text-center">
        <p>수강 중인 강의가 없습니다.</p>
        <Link to="/courses" className="mt-4 inline-block rounded bg-black px-4 py-2 text-white">
          강의 둘러보기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-bold">내 강의실</h1>
      <div className="space-y-4">
        {data.items.map((c) => (
          <div key={c.courseId} className="flex gap-4 rounded-lg border p-4">
            <img src={c.thumbnail} alt="" className="h-24 w-40 rounded object-cover" />
            <div className="flex-1">
              <h2 className="font-semibold">{c.title}</h2>
              <p className="text-sm text-gray-500">{c.instructor}</p>
              <div className="mt-2 h-2 w-full rounded bg-gray-200">
                <div className="h-2 rounded bg-blue-500" style={{ width: `${c.percent}%` }} />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {c.percent}% 완료 ({c.completedLectures}/{c.totalLectures})
              </p>
            </div>
            {c.resumeLectureId && (
              <Link to={`/learn/${c.resumeLectureId}`}
                    className="self-center rounded bg-black px-4 py-2 text-sm text-white">
                이어보기
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

라우트 (가드 안쪽): `<Route path="/my" element={<MyCoursesPage />} />`. 상단 네비게이션 바를 아직 안 만들었다면 지금 간단히 만들어 `/courses` 와 `/my` 링크, 로그아웃 버튼을 넣으세요.

---

## 4주차 완료 기준 검증

**핵심 시나리오 (전부 통과해야 함)**:

1. 강의를 2분 재생 → **탭을 완전히 닫음** → 다시 열어 로그인 → 내 강의실 → 이어보기 → **2분 지점부터 재생**
2. 재생 중 Network 탭에서 PATCH가 15초당 1건만 나감
3. 일시정지 시 즉시 저장됨
4. 영상의 90% 이상 시청 → 사이드바에 ✅, 수강률 반영
5. 뒤로 감아서 봐도 진도가 후퇴하지 않음
6. 내 강의실에 수강률 바가 정확히 표시됨

커밋: `week4: progress tracking complete` → [5주차](week5-polish-and-deploy.md)로.

## 자주 막히는 곳

| 증상 | 원인 |
|---|---|
| sendBeacon 요청이 서버에서 400 | `express.json({ type: [...] })` 에 text/plain 미포함 |
| beacon이 401 | 쿼리 토큰 방식 미들웨어 보강 누락 |
| 이어보기가 항상 0초부터 | `onCanPlay` 이전에 currentTime을 설정해서 무시됨 — 반드시 canplay 이후에 |
| 진도가 이상하게 완료 처리됨 | duration이 시드의 600초와 실제 영상 길이가 다름 — 시드 duration을 실제 영상 길이로 맞추거나, 서버가 lecture.duration 기준으로 판정한다는 걸 인지 |
| 강의 전환할 때 진도 저장 안 됨 | SPA 라우팅은 pagehide가 안 불림 — cleanup effect 누락 |
