import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { fetchPlayback } from '@/api/lectures';
import { getApiErrorCode } from '@/api/client';

export default function LearnPage() {
  const { lectureId } = useParams();
  const id = Number(lectureId);
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['playback', id],
    queryFn: () => fetchPlayback(id),
    staleTime: 0, // 만료되는
    gcTime: 0,
    retry: false,
  });

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
    <div className="mx-auto max-w-5xl p-4">
      <MediaPlayer src={data!.url} playsInline>
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    </div>
  );
}
