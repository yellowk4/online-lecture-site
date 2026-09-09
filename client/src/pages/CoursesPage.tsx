import { useState } from 'react';
import { fetchCourses } from '@/api/courses';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

export default function CoursesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['courses', page],
    queryFn: () => fetchCourses(page),
  });

  if (isLoading) {
    return <div className="flex justify-center p-8">로딩중...</div>;
  }

  if (isError || !data) {
    return <div className="flex justify-center p-8">목록을 불러오지 못했습니다.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-bold">강좌 목록</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((c) => (
          <Link
            key={c.id}
            to={`/courses/${c.id}`}
            className="overflow-hidden rounded-lg border transition hover:shadow-md"
          >
            <img src={c.thumbnail} alt="" className="aspect-video w-full object-cover" />
            <div className="p-4">
              <h2 className="font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {c.instructor} · {c.lectureCount}개 강의
              </p>
            </div>
          </Link>
        ))}
      </div>
      {data.totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: data.totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`rounded px-3 py-1 ${page === i + 1 ? 'bg-black text-white' : 'border'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
