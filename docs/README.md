# 온라인 강의 사이트 — 상세 실행 가이드

> 목표 한 문장: **"로그인해서 강의를 보고, 진도가 저장되고, 이어보기가 되는 사이트"**

이 폴더는 5주 계획을 실제로 손이 움직이는 수준까지 쪼갠 가이드입니다.
각 문서는 "왜 이걸 하는지 → 정확히 뭘 치는지 → 어떻게 확인하는지" 순서로 되어 있습니다.

## 문서 목차

| 문서 | 내용 | 예상 시간 |
|---|---|---|
| [week0-prep.md](week0-prep.md) | 사전 준비 — 도구 설치, PostgreSQL, 샘플 HLS 영상 확보 | 2~3시간 |
| [week1-setup-and-auth.md](week1-setup-and-auth.md) | 뼈대와 인증 — 폴더 구조, Prisma, 회원가입/로그인, JWT | 10시간 |
| [week2-courses.md](week2-courses.md) | 목록과 상세 — 강의 목록/상세 API, 수강 신청, FE 화면 | 10시간 |
| [week3-player.md](week3-player.md) | 플레이어 — playback API, HLS 재생, 강의 전환 | 10시간 |
| [week4-progress.md](week4-progress.md) | 진도 추적 — 진도 저장/복원, 이어보기, 내 강의실 | 10시간 |
| [week5-polish-and-deploy.md](week5-polish-and-deploy.md) | 마감 — 반응형, 에러 처리, README, 배포 | 10시간 |

## 진행 원칙 (다시 한번)

1. **DB → API → 화면** 순서로 한 기능씩 끝낸다. FE 전체 먼저 만들기 금지.
2. 각 주차의 **완료 기준을 통과해야** 다음 주차로 넘어간다. 동작 안 하는 상태로 넘어가지 말 것.
3. 완료 기준 통과 시점마다 **커밋**한다. 커밋 메시지 예: `week1: auth complete`
4. 범위 밖 기능(결제, 업로드, DRM, 관리자 화면)은 생각도 하지 말 것. 5주차 끝나고.

## 막혔을 때 판단 기준

- **30분 이상 같은 에러에 막혀 있다** → 그 기능을 더 단순한 버전으로 낮춘다. (예: refresh token이 안 되면 access token만으로 일단 진행)
- **계획에 없는 기능이 하고 싶어진다** → `docs/later.md` 파일에 한 줄 적고 잊는다.
- **라이브러리 선택이 고민된다** → 이 가이드에 적힌 것을 그대로 쓴다. 비교 검토는 시간 도둑.

---

## 기술 스택

### 백엔드 (`server/`)
| 분류 | 기술 |
|---|---|
| 런타임 / 언어 | Node.js + TypeScript (ESM) |
| 웹 프레임워크 | Express 5 |
| 데이터베이스 | PostgreSQL 16 + Prisma (ORM) |
| 인증 | JWT (jsonwebtoken) + bcryptjs (비밀번호 해싱) |
| 검증 | zod |
| 개발 도구 | tsx (개발 서버), tsc (빌드) |

### 프론트엔드 (`client/`)
| 분류 | 기술 |
|---|---|
| 프레임워크 | React + TypeScript + Vite |
| 스타일링 | Tailwind CSS v4 + shadcn/ui |
| 서버 상태 | TanStack Query (react-query) |
| 클라이언트 상태 | zustand |
| 라우팅 | react-router-dom |
| HTTP 클라이언트 | axios |

## 사전 준비

- Node.js, PostgreSQL 16 (`brew install postgresql@16`)
- DB 생성: `createdb lecture_site`
- 환경변수: `cp server/.env.example server/.env` 후 값 채우기 (파일 내 주석 참고)

## 실행 방법

터미널 2개로 백엔드/프론트를 각각 실행한다.

```bash
# 0. PostgreSQL 실행 확인 (한 번만)
brew services start postgresql@16

# 1. 백엔드 (http://localhost:4000)
cd server
npm install
npm run dev

# 2. 프론트엔드 (http://localhost:5173)
cd client
npm install
npm run dev
```

- 접속: http://localhost:5173 (브라우저)
- API 확인: http://localhost:4000/api/health → `{"ok":true}`
- `/api` 요청은 Vite 프록시가 4000으로 전달하므로 프론트 코드는 상대 경로(`/api/...`)를 사용한다.

## 포트

| 포트 | 용도 |
|---|---|
| 5173 | 프론트엔드 (Vite 개발 서버) |
| 4000 | 백엔드 API (Express) |
| 5432 | PostgreSQL |

## 주요 스크립트

| 위치 | 명령 | 설명 |
|---|---|---|
| server/ | `npm run dev` | 개발 서버 (tsx watch, 자동 재시작) |
| server/ | `npm run build` | 타입 검사 + `dist/`로 컴파일 |
| server/ | `npm start` | 컴파일된 결과 실행 (운영용) |
| client/ | `npm run dev` | Vite 개발 서버 (HMR) |
| client/ | `npm run build` | 배포용 정적 파일 빌드 |
| client/ | `npx shadcn@latest add <name>` | UI 컴포넌트 추가 |
