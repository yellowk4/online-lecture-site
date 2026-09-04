import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import './index.css';
import App from './App.tsx';

axios
  .post('/api/auth/refresh')
  .then(({ data }) => {
    useAuthStore.getState().setAuth(data.accessToken, data.user);
  })
  .catch(() => {})
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
