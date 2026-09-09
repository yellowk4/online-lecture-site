import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerSettings {
  rate: number; // 재생속도
  volume: number; // 볼룸   0부터 1사이
  muted: boolean;
  set: (partial: Partial<Omit<PlayerSettings, 'set'>>) => void; // Omit, 설정 타입에서 set함수를 뺀 것, 함수로 함수를 덮어쓰는 일을 막는다.
}

export const usePlayerStore = create<PlayerSettings>()(
  // () 미들웨어 persist 써서 필요
  persist(
    (set) => ({
      rate: 1,
      volume: 1,
      muted: false,
      set: (partial) => set(partial),
    }),
    { name: 'player-settings' },
  ),
);
