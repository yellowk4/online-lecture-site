import { api } from './client';

export interface Playback {
  url: string;
  expiresIn: number;
  courseId: number;
  title: string;
}

export async function fetchPlayback(lectureId: number) {
  const { data } = await api.get<Playback>(`/lectures/${lectureId}/playback`);
  return data;
}
