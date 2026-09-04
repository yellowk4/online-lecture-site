import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { api, getApiErrorCode } from '@/api/client';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/login', { email, password });

      setAuth(data.accessToken, data.user);
      navigate('/'); // 로그인 성공 시 홈으로 이동
    } catch (err) {
      setError(
        getApiErrorCode(err) === 'INVALID_CREDENTIALS'
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : '로그인 중 오류가 발생했습니다.',
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form className="w-80 space-y-4" onSubmit={onSubmit}>
        <h1 className="text-2xl font-bold">Login</h1>
        <input
          className="w-full rounded border px-3 py-2"
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded border px-3 py-2"
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-500">{error}</p>}
        <button
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
          type="submit"
        >
          로그인
        </button>
        <Link to="/signup" className="text-blue-500 hover:underline">
          회원가입
        </Link>
      </form>
    </div>
  );
}

export default LoginPage;
