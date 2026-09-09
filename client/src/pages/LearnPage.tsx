import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { fetchPlayback } from '@/api/lectures';
import { getApiErrorCode } from '@/api/client';
import { fetchCourse } from '@/api/courses';
import { usePlayerStore } from '@/stores/player';

export default function LearnPage() {
  const { lectureId } = useParams();
  const id = Number(lectureId);
  const navigate = useNavigate();
  const { rate, volume, muted, set } = usePlayerStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ['playback', id],
    queryFn: () => fetchPlayback(id),
    staleTime: 0, // 만료되는
    gcTime: 0,
    retry: false,
  });

  const { data: course } = useQuery({
    queryKey: ['course', data?.courseId],
    queryFn: () => fetchCourse(data!.courseId),
    enabled: !!data?.courseId,
  });

  // 현재 강의의 다음 강의 계산
  const lectures = course?.lectures ?? [];
  const currentIndex = lectures.findIndex((l) => l.id === id);
  const nextLecture = currentIndex >= 0 ? lectures[currentIndex + 1] : undefined;

  if (isLoading) return <p className="p-8">로딩 중...</p>;

  if (error) {
    const code = getApiErrorCode(error);
    if (code === 'NOT_ENROLLED' || code === 'ENROLLMENT_EXPIRED') {
      return (
        <div className="p-8 text-center">
          <p>
            {code === 'NOT_ENROLLED'
              ? '수강 신청 후 볼 수 있는 강의입니다.'
              : '수강 기간이 만료된 강의입니다.'}
          </p>
          <button onClick={() => navigate(-1)} className="mt-4 rounded border px-4 py-2">
            돌아가기
          </button>
        </div>
      );
    }
    return <p className="p-8">영상을 불러오지 못했습니다.</p>;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 lg:flex-row">
      <div className="flex-1">
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
              <Link
                to={`/learn/${lec.id}`}
                className={`block p-3 text-sm hover:bg-gray-50 ${lec.id === id ? 'bg-gray-100 font-semibold' : ''}`}
              >
                {i + 1}. {lec.title}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
