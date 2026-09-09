import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { enroll, fetchCourse } from '@/api/courses';
import { getApiErrorCode } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CourseDetailPage() {
  const { id } = useParams();
  const courseId = Number(id);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isLoggedIn = useAuthStore((s) => !!s.accessToken);
  const [open, setOpen] = useState(true); // 처음 열린 상태 true

  const {
    data: course,
    isLoading,
    // isError,
  } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => fetchCourse(courseId),
  });

  const enrollMutation = useMutation({
    mutationFn: () => enroll(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
    onError: (err) => {
      if (getApiErrorCode(err) === 'ALREADY_ENROLLED') {
        // alert('이미 수강 중인 강좌입니다.');
        queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      } else {
        alert('수강 신청에 실패했습니다.');
      }
    },
  });

  if (isLoading || !course) {
    return <div>로딩 중...</div>;
  }

  function onEnrollClick() {
    if (!isLoggedIn) {
      alert('로그인 후 수강 신청이 가능합니다.');
      navigate('/login');
      return;
    }
    enrollMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <img src={course.thumbnail} alt="" className="aspect-video w-full rounded-lg object-cover" />
      <h1 className="mt-6 text-3xl font-bold">{course.title}</h1>
      <p className="mt-1 text-gray-500">{course.instructor}</p>
      <p className="mt-4">{course.description}</p>

      {course.enrolled ? (
        <button
          onClick={() => navigate(`/learn/${course.lectures[0].id}`)}
          className="mt-6 w-full rounded bg-green-600 py-3 font-semibold text-white"
        >
          이어서 학습하기
        </button>
      ) : (
        <button
          onClick={onEnrollClick}
          disabled={enrollMutation.isPending} //true면 버튼 비활성화 중복 클릭 방지
          className="mt-6 w-full rounded bg-black py-3 font-semibold text-white disabled:opacity-50"
        >
          수강 신청
        </button>
      )}

      <div className="mt-8 rounded-lg border">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between p-4 font-semibold"
        >
          커리큘럼 ({course.lectures.length}개 강의)
          <span>{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <ul className="divide-y border-t">
            {course.lectures.map((lec, i) => (
              <li key={lec.id} className="flex items-center justify-between p-4 text-sm">
                <span>
                  {i + 1}. {lec.title}
                </span>
                <span className="text-gray-400">{formatDuration(lec.duration)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
