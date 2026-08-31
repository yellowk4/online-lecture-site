# 5주차 — 마감 (10시간)

> **완료 기준**: 남에게 URL을 보내줄 수 있는 상태

## 시간 배분

| 작업 | 시간 |
|---|---|
| 1. URL 만료 시 재발급 처리 (3주차에서 미룬 것) | 2h |
| 2. 반응형 (모바일 레이아웃) | 2h |
| 3. 스켈레톤 로딩 + 에러 바운더리 | 2h |
| 4. README 작성 | 1h |
| 5. 배포 | 3h |

---

## 1. Signed URL 만료 시 재발급 (2h)

3주차에서 로컬 서빙 + 서명을 붙였다면, **10분짜리 서명이 긴 강의 재생 중에 만료**됩니다. 이 처리를 안 하면 "보다가 갑자기 멈춤" 버그가 됩니다.

> 외부 테스트 스트림만 쓰고 서명을 안 붙였다면 이 절은 건너뛰되, README에 "Signed URL + 재발급은 설계만 하고 구현은 생략" 이라고 명시하세요. 구현했다면 포트폴리오에서 가장 어필되는 부분입니다.

Vidstack에서 에러를 잡아 재발급:

```tsx
// LearnPage.tsx
const [reloadKey, setReloadKey] = useState(0);
const resumeAfterError = useRef(0);

function onError() {
  // 위치를 기억하고 playback 쿼리를 다시 던진다
  resumeAfterError.current = playerRef.current?.currentTime ?? 0;
  queryClient.invalidateQueries({ queryKey: ['playback', id] });
  setReloadKey((k) => k + 1);
}

// onCanPlay에서 복원 위치 우선순위: 에러 복구 위치 > 서버 저장 진도
function onCanPlay() {
  const resume = resumeAfterError.current || data!.resumePosition;
  resumeAfterError.current = 0;
  if (resume > 5 && playerRef.current) playerRef.current.currentTime = resume;
}
```

```tsx
<MediaPlayer key={reloadKey} src={data!.url} onError={onError} onCanPlay={onCanPlay} /* ... */>
```

**확인 방법**: 서명 TTL을 임시로 30초로 줄이고 재생 → 30초 후 세그먼트 요청이 403 → 에러 핸들러 → 새 URL로 재로딩 → **보던 위치에서 계속**. 확인 후 TTL 원복(600초).

---

## 2. 반응형 (2h)

이미 Tailwind 브레이크포인트로 대부분 처리했다면 이번 주는 확인+보수입니다. 체크 포인트:

- **재생 페이지**: `lg:flex-row` 였으므로 모바일에선 플레이어 아래에 커리큘럼이 세로로 온다 — 3주차 코드가 이미 그렇게 되어 있음. 실기기(폰)에서 확인.
- **목록 그리드**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — 확인만.
- **내 강의실 카드**: 모바일에서 가로 배치가 깨지면 `flex-col sm:flex-row` 로.
- **플레이어 터치 동작**: 모바일 Safari에서 재생/일시정지, 전체화면 확인. `playsInline` 이 없으면 iOS에서 강제 전체화면이 되니 확인.

모바일 확인 방법: 개발 머신과 같은 와이파이에서 `npm run dev -- --host` 후 폰 브라우저로 `http://<맥IP>:5173` 접속. (이때 API 프록시는 vite가 처리하므로 그대로 동작)

---

## 3. 스켈레톤 로딩 + 에러 바운더리 (2h)

### 스켈레톤

"불러오는 중..." 텍스트를 회색 박스 스켈레톤으로 교체. 공용 컴포넌트 하나면 충분:

```tsx
// components/Skeleton.tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}
```

목록 페이지 예:

```tsx
if (isLoading) return (
  <div className="mx-auto max-w-5xl p-8">
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="mt-3 h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  </div>
);
```

같은 패턴으로 상세/내 강의실에도. 재생 페이지는 플레이어 영역에 `aspect-video` 스켈레톤 하나.

### 에러 바운더리

렌더링 중 예외로 흰 화면이 되는 것 방지. `react-error-boundary` 패키지가 가장 간단:

```bash
npm i react-error-boundary
```

```tsx
// App.tsx에서 라우터를 감싸기
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary fallback={
  <div className="p-8 text-center">
    <p>문제가 발생했습니다.</p>
    <button onClick={() => location.reload()} className="mt-4 rounded border px-4 py-2">
      새로고침
    </button>
  </div>
}>
  <BrowserRouter>...</BrowserRouter>
</ErrorBoundary>
```

API 에러는 이미 각 페이지에서 `isError` 로 처리 중이므로, 바운더리는 최후의 안전망입니다.

---

## 4. README 작성 (1h)

포트폴리오로 보여줄 문서입니다. 구성:

```markdown
# 온라인 강의 사이트

로그인해서 강의를 보고, 진도가 저장되고, 이어보기가 되는 사이트.

## 데모
(배포 URL + 테스트 계정 email/password)

## 스크린샷
(목록 / 재생 페이지 / 내 강의실 — 3장이면 충분)

## 기술 스택
(표로 간단히)

## 실행 방법
### 요구사항: Node 20+, PostgreSQL 16
### server
    cd server
    cp .env.example .env   # DATABASE_URL 수정
    npm i
    npx prisma migrate dev
    npx prisma db seed
    npm run dev
### client
    cd client
    npm i
    npm run dev

## 설계 판단 (이 부분이 차별화 포인트)
- 진도 저장: timeupdate throttle 15s + pause + pagehide/sendBeacon. 이유와 트래픽 계산.
- 진도 갱신은 MAX 멱등 — 뒤로 감기로 완료가 후퇴하지 않음.
- 영상 URL은 playback API에서만 발급, 매 요청 enrollment 검증.
- Signed URL 10분 만료 + 재생 중 만료 시 자동 재발급 (currentTime 유지).

## 한계와 다음 단계
- m3u8에만 서명, 세그먼트 단위 서명은 미구현
- 결제/업로드/DRM 범위 밖
```

`.env.example` 파일 만드는 것 잊지 말 것 (`.env` 를 커밋하면 안 되므로).

스크린샷은 `docs/screenshots/` 에 저장.

---

## 5. 배포 (3h)

가장 덜 막히는 조합: **FE는 Vercel, BE+DB는 Railway**.

### 5-1. Railway (서버 + PostgreSQL)

1. [railway.app](https://railway.app) 가입 → New Project → **Deploy PostgreSQL** 추가
2. 같은 프로젝트에 **GitHub Repo 연결** → Root Directory를 `server` 로 지정
3. 환경변수 설정:
   - `DATABASE_URL`: Railway PostgreSQL의 접속 문자열 (Variables 탭에서 참조 가능)
   - `JWT_SECRET`, `JWT_REFRESH_SECRET`: 새로 생성한 랜덤 값 (개발용 재사용 금지)
   - `NODE_ENV=production`
4. Build/Start 커맨드: `npm run build` / `npm start`
   - 배포 시 마이그레이션이 돌도록 `package.json` 에: `"start": "prisma migrate deploy && node dist/index.js"`
5. 배포 후 Railway가 준 도메인으로 `/api/health` 확인
6. 시드: Railway 콘솔에서 `npx prisma db seed` 1회 실행

### 5-2. Vercel (클라이언트)

1. [vercel.com](https://vercel.com) 가입 → 저장소 import → Root Directory를 `client` 로
2. **프록시 대신 rewrite**: 개발에선 vite proxy를 썼지만 프로덕션은 Vercel rewrite로. `client/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://<railway-도메인>/api/:path*" }
  ]
}
```

이렇게 하면 FE 코드는 그대로 `/api/...` 를 호출하면 되고, **쿠키가 same-origin으로 동작**해서 refresh 토큰 쿠키 문제(SameSite, 크로스 도메인)를 통째로 피합니다. CORS 설정도 사실상 필요 없어집니다.

3. 배포 후 전체 시나리오 테스트: 회원가입 → 수강신청 → 재생 → 탭 닫기 → 이어보기

### 5-3. 배포 후 서버 CORS 정리

rewrite 방식이면 브라우저 입장에서 same-origin이므로 서버의 cors 설정은 로컬 개발용 origin만 남겨도 됩니다. 단, `secure: true` 쿠키가 되도록 `NODE_ENV=production` 확인.

> **대안 (Mac Mini 서버)**: 이미 운영 중인 Mac Mini가 있다면 `pm2` 로 서버를 돌리고 Cloudflare Tunnel로 노출하는 방법도 있습니다. 다만 Railway 쪽이 막힐 구석이 적으니, 배포 자체가 처음이면 Railway 추천.

---

## 최종 점검 리스트 (출시 전 20분)

- [ ] 시크릿 창에서 처음부터: 가입 → 둘러보기 → 신청 → 재생 → 이어보기
- [ ] 모바일(실기기)에서 재생 + 이어보기
- [ ] 틀린 비밀번호, 비수강 강의 접근 등 에러 경로가 사용자 문구로 나옴
- [ ] `.env` 가 저장소에 없고 `.env.example` 이 있음
- [ ] README의 실행 방법대로 클론 → 실행이 실제로 됨 (가능하면 다른 폴더에 클론해서 검증)
- [ ] 테스트 계정이 시드에 포함되어 README에 적혀 있음

전부 체크되면 끝. 커밋: `week5: ship it` 🚢

---

## 그 다음은?

`docs/later.md` 에 쌓아둔 것들과 계획서의 확장 아이디어 중 **하나만** 골라서 같은 방식(DB → API → 화면)으로. 추천 순서:

1. **시청 기록 기반 이어보기 배너** — 이미 있는 Progress 데이터로 만들 수 있어 가성비 최고
2. 검색/카테고리 필터
3. 자막(VTT) — Vidstack이 track 지원하므로 붙이기 쉬움
