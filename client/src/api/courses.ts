import { api } from './client';
import type { Paginated } from './types';

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

export interface Enrollment {
  id: number;
  userId: number;
  courseId: number;
  createdAt: string;
  expiresAt: string | null;
}

export interface CourseDetail extends Omit<CourseSummary, 'lectureCount'> {
  // lectureCount를 제외한 CourseSummary
  lectures: LectureSummary[];
  enrolled: boolean;
}

export async function fetchCourses(page = 1) {
  const { data } = await api.get<Paginated<CourseSummary>>('/courses', {
    params: { page, size: 6 },
  });
  return data;
}

export async function fetchCourse(id: number) {
  const { data } = await api.get<CourseDetail>(`/courses/${id}`);
  return data;
}

export async function enroll(courseId: number) {
  const { data } = await api.post<{ enrollment: Enrollment }>('/enrollments', { courseId });
  return data.enrollment;
}
