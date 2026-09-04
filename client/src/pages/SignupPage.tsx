import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { api, getApiErrorCode } from '@/api/client';
import { Link, useNavigate } from 'react-router-dom';

function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/signup', { email, password, name });
      setAuth(data.accessToken, data.user);
      navigate('/'); // 성공 시 홈으로 이동
    } catch (err) {
      const code = getApiErrorCode(err);
      setError(
        code === 'EMAIL_TAKEN'
          ? '이미 가입된 이메일입니다.'
          : code === 'INVALID_INPUT'
            ? '이메일 또는 비밀번호 형식이 올바르지 않습니다.'
            : '회원가입 중 오류가 발생했습니다.',
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form className="w-80 space-y-4" onSubmit={onSubmit}>
        <h1 className="text-2xl font-bold">회원가입</h1>
        <input
          className="w-full rounded border px-3 py-2"
          type="text"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          등록
        </button>
        <Link to="/login" className="text-blue-500 hover:underline">
          로그인
        </Link>
      </form>
    </div>
  );
}

export default SignupPage;
