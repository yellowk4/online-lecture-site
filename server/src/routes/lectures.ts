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

  // 권한은 서버가 최종 판단 - 매 요청마다 확인
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: req.userId!, courseId: lecture.course.id } },
  });
  if (!enrollment) return fail(res, 403, 'NOT_ENROLLED', '수강 중인 강의가 아닙니다.');
  if (enrollment.expiresAt && enrollment.expiresAt < new Date())
    return fail(res, 403, 'ENROLLMENT_EXPIRED', '수강 기간이 만료되었습니다.');

  res.json({
    url: lecture.videoUrl,
    expiresIn: 600,
    courseId: lecture.course.id,
    title: lecture.title,
  });
});

export default router;
