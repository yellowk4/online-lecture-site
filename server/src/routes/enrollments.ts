import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { fail } from '../lib/errors.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/enrollments
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const courseId = Number(req.body?.courseId);
  if (!Number.isInteger(courseId)) {
    return fail(res, 400, 'INVALID_INPUT', '잘못된 요청입니다.');
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return fail(res, 404, 'COURSE_NOT_FOUND', '강좌를 찾을 수 없습니다.');
  }

  try {
    const enrollment = await prisma.enrollment.create({
      data: {
        userId: req.userId!, // requireAuth 미들웨어에서 userId가 설정되므로 받드시 있다
        courseId,
      },
    });
    res.status(201).json({ enrollment }); // 201 새로 생성됨
  } catch (e: any) {
    // any 타입 개선 필요
    if (e.code === 'P2002') {
      return fail(res, 409, 'ALREADY_ENROLLED', '이미 수강 중인 강좌입니다.');
    }
    throw e;
  }
});

export default router;
