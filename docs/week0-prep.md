# 0주차 — 사전 준비 (2~3시간)

1주차를 시작하기 전에 환경을 미리 갖춥니다. 여기서 막히면 1주차 10시간이 환경 설정으로 증발합니다.

## 체크리스트

- [ ] Node.js 20+ 설치 확인
- [ ] PostgreSQL 설치 및 실행
- [ ] 샘플 HLS 영상 URL 2~3개 확보 (재생 확인까지)
- [ ] 저장소 생성

---

## 1. Node.js 확인

```bash
node -v
```

v20 이상이면 통과. 아니면 [nodejs.org](https://nodejs.org) LTS 설치 또는:

```bash
brew install node@22
```

## 2. PostgreSQL 설치 (macOS)

가장 간단한 방법은 Homebrew:

```bash
brew install postgresql@16
```

```bash
brew services start postgresql@16
```

설치 확인 및 DB 생성:

```bash
createdb lecture_site
```

```bash
psql lecture_site -c "SELECT version();"
```

버전이 출력되면 성공.

> **대안**: Docker가 익숙하면 `docker run -d --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16` 도 됩니다. 단, 매번 컨테이너 켜는 걸 잊으면 "DB 연결 안 됨" 에러로 시간을 낭비하니 brew services 쪽을 추천.

이후 사용할 접속 문자열 (메모해 두세요):

```
postgresql://<맥 사용자명>@localhost:5432/lecture_site
```

brew로 설치한 PostgreSQL은 기본적으로 현재 macOS 사용자명으로 비밀번호 없이 접속됩니다. `whoami` 로 사용자명 확인.

## 3. 샘플 HLS 영상 확보 — 가장 중요

**절대 직접 인코딩하지 마세요.** 공개 테스트 스트림을 그대로 씁니다.

### 옵션 A: 공개 테스트 스트림 URL 사용 (추천 — 0분 소요)

아래 URL들은 널리 쓰이는 공개 HLS 테스트 스트림입니다. 개발 내내 이걸 씁니다.

| 이름 | URL | 길이 |
|---|---|---|
| Mux 테스트 스트림 | `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` | ~10분 |
| Apple 예제 (bipbop) | `https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8` | 반복 |
| Sintel (오픈 무비) | `https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8` | ~15분 |

**지금 바로 재생 확인**: [hls.js 데모 페이지](https://hlsjs.video-dev.org/demo/)에 위 URL을 붙여넣고 재생되는지 확인. 재생되면 그 URL을 시드 데이터에 넣을 겁니다.

### 옵션 B: 로컬 정적 서빙 (4주차 Signed URL 실습 때 필요)

Signed URL 검증을 제대로 하려면 **내 서버가 서빙하는 파일**이어야 합니다. 3주차까지는 옵션 A로 진행하고, 4주차에 아래를 준비하세요.

오픈 라이선스 영상(예: Big Buck Bunny mp4)을 받아 ffmpeg로 한 번만 변환:

```bash
brew install ffmpeg
```

```bash
mkdir -p server/public/videos/sample1
```

```bash
ffmpeg -i input.mp4 -codec copy -start_number 0 -hls_time 10 -hls_list_size 0 -f hls server/public/videos/sample1/index.m3u8
```

`-codec copy`라 재인코딩 없이 몇 초 만에 끝납니다. 이건 "인코딩 파이프라인 구축"이 아니라 파일 변환 1회입니다.

## 4. 저장소 생성

```bash
mkdir -p ~/online-lecture-site && cd ~/online-lecture-site && git init
```

`.gitignore` 먼저:

```
node_modules/
dist/
.env
*.local
```

첫 커밋:

```bash
git add -A && git commit -m "chore: init repository"
```

---

## 완료 기준

- `psql lecture_site` 접속이 된다
- hls.js 데모 페이지에서 샘플 스트림이 재생된다
- git 저장소에 첫 커밋이 있다

이 3개가 되면 [1주차](week1-setup-and-auth.md)로.
