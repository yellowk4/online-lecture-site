# 2주차 — 목록과 상세 (10시간)

> **완료 기준**: 강의를 둘러보고 수강 신청 버튼이 동작

## 시간 배분

| 작업 | 시간 |
|---|---|
| 1. 강의 목록 API (페이징) | 1.5h |
| 2. 강의 상세 API (커리큘럼 포함) | 1.5h |
| 3. 수강 신청 API | 1.5h |
| 4. FE: TanStack Query 셋업 + 목록 그리드 | 2.5h |
| 5. FE: 상세 페이지 + 커리큘럼 아코디언 + 신청 버튼 | 3h |

**원칙 그대로**: API 하나 완성 → curl로 확인 → 그 API를 쓰는 화면 완성 → 다음 API. 왔다갔다하지 않기.

---

## 1. 강의 목록 API (1.5h)

`server/src/routes/courses.ts`:

```ts
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { fail } from '../lib/errors.js';

const router = Router();

// GET /api/courses?page=1&size=12
router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.min(50, Number(req.query.size) || 12);

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      skip: (page - 1) * size,
      take: size,
      orderBy: { id: 'desc' },
      select: {
        id: true, title: true, description: true,
        thumbnail: true, instructor: true,
        _count: { select: { lectures: true } },
      },
    }),
    prisma.course.count(),
  ]);

  res.json({
    items: items.map((c) => ({ ...c, lectureCount: c._count.lectures, _count: undefined })),
    page,
    size,
    total,
    totalPages: Math.ceil(total / size),
  });
});

export default router;
```

`index.ts` 에 등록:

```ts
import coursesRouter from './routes/courses.js';
app.use('/api/courses', coursesRouter);
```

**확인**:

```bash
curl -s 'http://localhost:4000/api/courses?page=1&size=12'
```

`items` 2개, `total: 2` 가 나오면 통과.

> **페이징을 offset 방식으로 하는 이유**: 강의가 수천 개가 아닌 이상 cursor 페이징은 과합니다. 시드 데이터 2개로는 페이징이 눈에 안 보이니, 원하면 시드에서 코스를 20개로 늘려 페이징 UI를 확인하세요.

---

## 2. 강의 상세 API (1.5h)

같은 파일에 추가:

```ts
// GET /api/courses/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 400, 'INVALID_ID', '잘못된 요청입니다.');

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      lectures: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, duration: true, order: true },
        // videoUrl은 여기서 절대 내려주지 않는다! (3주차 playback API의 존재 이유)
      },
    },
  });
  if (!course) return fail(res, 404, 'COURSE_NOT_FOUND', '강의를 찾을 수 없습니다.');

  res.json(course);
});
```

**중요한 설계 판단**: 상세 API는 `videoUrl` 을 **내려주지 않습니다**. 영상 URL은 수강 권한을 확인하는 `/playback` API(3주차)에서만 발급합니다. 여기서 내려주면 URL 보호가 무의미해집니다.

**확인**:

```bash
curl -s http://localhost:4000/api/courses/1
```

`lectures` 5개가 order 순으로 나오고, `videoUrl` 이 **없으면** 통과.

---

## 3. 수강 신청 API (1.5h)

인증이 필요한 첫 API입니다. `server/src/routes/enrollments.ts`:

```ts
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { fail } from '../lib/errors.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/enrollments  body: { courseId }
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const courseId = Number(req.body?.courseId);
  if (!Number.isInteger(courseId)) return fail(res, 400, 'INVALID_INPUT', '잘못된 요청입니다.');

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return fail(res, 404, 'COURSE_NOT_FOUND', '강의를 찾을 수 없습니다.');

  try {
    const enrollment = await prisma.enrollment.create({
      data: { userId: req.userId!, courseId },
    });
    res.status(201).json(enrollment);
  } catch (e: any) {
    if (e.code === 'P2002') {
      // @@unique([userId, courseId]) 위반 = 이미 신청함
      return fail(res, 409, 'ALREADY_ENROLLED', '이미 수강 중인 강의입니다.');
    }
    throw e;
  }
});

export default router;
```

`index.ts` 등록:

```ts
import enrollmentsRouter from './routes/enrollments.js';
app.use('/api/enrollments', enrollmentsRouter);
```

**확인** (로그인해서 토큰 받고, 그 토큰으로 신청):

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"password123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])") && curl -s -X POST http://localhost:4000/api/enrollments -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"courseId":1}'
```

- 첫 호출: 201 + enrollment 객체
- 같은 명령 재실행: `ALREADY_ENROLLED` 409
- 토큰 없이 호출: `UNAUTHORIZED` 401

3가지 다 확인하면 통과. 커밋: `week2: courses + enrollments api`

### 상세 API에 "내 수강 여부" 끼워넣기

FE에서 "수강 신청" 버튼과 "이어서 학습" 버튼을 구분하려면 상세 응답에 수강 여부가 필요합니다. 상세 API를 이렇게 보강하세요 (로그인 안 한 사용자도 볼 수 있어야 하므로 **토큰이 있으면 확인, 없으면 false**):

```ts
import jwt from 'jsonwebtoken';

function tryGetUserId(req: any): number | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { sub: number };
    return Number(payload.sub);
  } catch {
    return null;
  }
}

// GET /api/courses/:id 안에서, course 조회 후:
const userId = tryGetUserId(req);
const enrolled = userId
  ? !!(await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: id } },
    }))
  : false;

res.json({ ...course, enrolled });
```

---

## 4. FE: 목록 그리드 (2.5h)

### API 타입과 함수를 한 곳에

`client/src/api/courses.ts`:

```ts
import { api } from './client';

export interface CourseSummary {
  id: number;
  title: string;
  description: string;
  thumbnail: string;
  instructor: string;
  lectureCount: number;
}

export interface LectureSummary {
  id: number;
  title: string;
  duration: number;
  order: number;
}

export interface CourseDetail extends Omit<CourseSummary, 'lectureCount'> {
  lectures: LectureSummary[];
  enrolled: boolean;
}

export async function fetchCourses(page = 1) {
  const { data } = await api.get('/courses', { params: { page, size: 12 } });
  return data as { items: CourseSummary[]; page: number; totalPages: number; total: number };
}

export async function fetchCourse(id: number) {
  const { data } = await api.get(`/courses/${id}`);
  return data as CourseDetail;
}

export async function enroll(courseId: number) {
  const { data } = await api.post('/enrollments', { courseId });
  return data;
}
```

> 계획서의 `openapi-typescript` 는 5주차 여유 있을 때. 지금은 수동 타입이 더 빠릅니다. API가 8개뿐이라 수동으로도 충분히 관리됩니다.

### 목록 페이지

`client/src/pages/CoursesPage.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCourses } from '../api/courses';

export default function CoursesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['courses', page],
    queryFn: () => fetchCourses(page),
  });

  if (isLoading) return <p className="p-8">불러오는 중...</p>;
  if (isError || !data) return <p className="p-8">목록을 불러오지 못했습니다.</p>;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-bold">강의 목록</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((c) => (
          <Link key={c.id} to={`/courses/${c.id}`}
                className="overflow-hidden rounded-lg border transition hover:shadow-md">
            <img src={c.thumbnail} alt="" className="aspect-video w-full object-cover" />
            <div className="p-4">
              <h2 className="font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-gray-500">{c.instructor} · {c.lectureCount}개 강의</p>
            </div>
          </Link>
        ))}
      </div>
      {data.totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: data.totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
                    className={`rounded px-3 py-1 ${page === i + 1 ? 'bg-black text-white' : 'border'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

라우터에 추가 (`App.tsx`) — 목록은 비로그인도 볼 수 있게 가드 **바깥**에:

```tsx
<Route path="/courses" element={<CoursesPage />} />
<Route path="/courses/:id" element={<CourseDetailPage />} />
```

`HomePage`(`/`)는 일단 `/courses` 로 리다이렉트해도 됩니다: `<Route path="/" element={<Navigate to="/courses" replace />} />`

---

## 5. FE: 상세 페이지 + 아코디언 + 신청 버튼 (3h)

`client/src/pages/CourseDetailPage.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { enroll, fetchCourse } from '../api/courses';
import { useAuthStore } from '../stores/auth';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CourseDetailPage() {
  const { id } = useParams();
  const courseId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isLoggedIn = useAuthStore((s) => !!s.accessToken);
  const [open, setOpen] = useState(true); // 섹션이 하나뿐이라 아코디언도 1개

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => fetchCourse(courseId),
  });

  const enrollMutation = useMutation({
    mutationFn: () => enroll(courseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course', courseId] }),
    onError: (err: any) => {
      if (err.response?.data?.code === 'ALREADY_ENROLLED') {
        queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      } else {
        alert('수강 신청에 실패했습니다.');
      }
    },
  });

  if (isLoading || !course) return <p className="p-8">불러오는 중...</p>;

  function onEnrollClick() {
    if (!isLoggedIn) return navigate('/login');
    enrollMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <img src={course.thumbnail} alt="" className="aspect-video w-full rounded-lg object-cover" />
      <h1 className="mt-6 text-3xl font-bold">{course.title}</h1>
      <p className="mt-1 text-gray-500">{course.instructor}</p>
      <p className="mt-4">{course.description}</p>

      {course.enrolled ? (
        <button onClick={() => navigate(`/learn/${course.lectures[0].id}`)}
                className="mt-6 w-full rounded bg-green-600 py-3 font-semibold text-white">
          이어서 학습하기
        </button>
      ) : (
        <button onClick={onEnrollClick} disabled={enrollMutation.isPending}
                className="mt-6 w-full rounded bg-black py-3 font-semibold text-white disabled:opacity-50">
          수강 신청
        </button>
      )}

      <div className="mt-8 rounded-lg border">
        <button onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between p-4 font-semibold">
          커리큘럼 ({course.lectures.length}개 강의)
          <span>{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <ul className="divide-y border-t">
            {course.lectures.map((lec, i) => (
              <li key={lec.id} className="flex items-center justify-between p-4 text-sm">
                <span>{i + 1}. {lec.title}</span>
                <span className="text-gray-400">{formatDuration(lec.duration)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

`/learn/:lectureId` 라우트는 3주차에 만듭니다. 지금은 클릭 시 404여도 정상.

---

## 2주차 완료 기준 검증

1. `/courses` 에서 강의 2개가 카드 그리드로 보인다
2. 카드 클릭 → 상세 페이지, 커리큘럼 5개가 순서대로 보인다
3. 비로그인 상태에서 "수강 신청" 클릭 → 로그인 페이지로 이동
4. 로그인 후 "수강 신청" 클릭 → 버튼이 "이어서 학습하기"로 바뀐다
5. 새로고침해도 "이어서 학습하기"가 유지된다 (enrolled가 서버에서 옴)

커밋: `week2: course list + detail + enrollment` → [3주차](week3-player.md)로.

## 자주 막히는 곳

| 증상 | 원인 |
|---|---|
| 목록은 되는데 상세에서 `enrolled` 가 항상 false | 상세 요청에 Authorization 헤더가 안 붙음 — `api` 인스턴스 대신 `axios` 를 직접 쓰지 않았는지 확인 |
| 신청 후 버튼이 안 바뀜 | `invalidateQueries` 의 queryKey 불일치 (`['course', id]` 의 id 타입이 문자열 vs 숫자) |
| P2002 에러가 그대로 500으로 터짐 | catch에서 `e.code` 확인 로직 누락 |
