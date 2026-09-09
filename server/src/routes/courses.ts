import { Router, type Request } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { fail } from '../lib/errors.js';

const router = Router();

// 토큰이 있으면 userId를, 없거나 유효하지 않으면 null을 돌려준다 (비로그인도 통과)
function tryGetUserId(req: Request): number | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as {
      sub: string | number;
    };
    return Number(payload.sub);
  } catch {
    return null;
  }
}

// GET /api/courses?page=1&size10
router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); // 1페이지부터 시작, 0페이지는 허용하지 않음
  const size = Math.min(50, Number(req.query.size) || 10); // 한 페이지에 최대 50개까지만 허용, 기본값 10

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      skip: (page - 1) * size, // 1페이지면 skip 0, 2페이지면 skip 10, 3페이지면 skip 20
      take: size, // 한 페이지에 size만큼 가져오기
      orderBy: { id: 'desc' },
      select: {
        // 필요한 필드만 가져오기
        id: true,
        title: true,
        description: true,
        thumbnail: true,
        instructor: true,
        _count: { select: { lectures: true } }, // 강의 갯수만 가져오기 위해 _count 사용
      },
    }),
    prisma.course.count(),
  ]);

  // 응답 만들기
  res.json({
    items: items.map((c) => ({ ...c, lectureCount: c._count.lectures, _count: undefined })), // _count 제거하고 lectureCount로 바꿔서 응답
    page, // 현재 페이지
    size, // 한 페이지에 몇 개 가져왔는지
    total, // 전체 강좌 갯수
    totalPages: Math.ceil(total / size), // 전체 페이지 수, 올림처리
  });
});

// GET /api/courses/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 400, 'INVALID_ID', '잘못된 요청입니다.');

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      // 강의 목록도 함께 가져오기, select와 차이점 확인하기
      lectures: {
        orderBy: { order: 'asc' }, // 강의 순서대로 가져오기 10. 20. 30
        select: {
          id: true,
          title: true,
          duration: true,
          // videoUrl: true, // 강의 상세 페이지에서만 필요하므로 여기서는 가져오지 않음
          order: true,
        },
      },
    },
  });

  if (!course) return fail(res, 404, 'COURSE_NOT_FOUND', '강좌를 찾을 수 없습니다.');

  // 내 수강 여부: 로그인했으면 확인, 아니면 false
  const userId = tryGetUserId(req);
  const enrolled = userId
    ? !!(await prisma.enrollment.findUnique({
        // !! 를 붙여서 null이면 false, 있으면 true로 변환
        where: { userId_courseId: { userId, courseId: id } },
      }))
    : false;

  res.json({ ...course, enrolled }); // enrolled: true/false 추가
});

export default router;
