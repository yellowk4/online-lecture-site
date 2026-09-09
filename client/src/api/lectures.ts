import { api } from './client';

export interface Playback {
  url: string;
  expiresIn: number;
}

export async function fetchPlayback(lectureId: number) {
  const { data } = await api.get<Playback>(`/lectures/${lectureId}/playback`);
  return data;
}
