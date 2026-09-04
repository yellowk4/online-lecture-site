import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  try {
    const { data } = await axios.post('/api/auth/refresh');
    useAuthStore.getState().setAuth(data.accessToken, data.user);
    return data.accessToken;
  } catch {
    useAuthStore.getState().clearAuth();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retried) {
      original._retried = true;
      refreshing ??= tryRefresh().finally(() => (refreshing = null));
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function getApiErrorCode(err: unknown): string | undefined {
  return axios.isAxiosError<{ code?: string }>(err) ? err.response?.data?.code : undefined;
}
