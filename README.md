# 링크피움 (LinkPium)

강의 중 링크·AI 프롬프트·공지를 참여자 노트북에 실시간으로 띄우는 자료 공유 보드. PRD: `링크피움_LinkPium_PRD.md`

- **스택:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Firebase (Auth · Firestore) · Vercel
- **실시간:** Firestore `onSnapshot` (자동 재연결, 재연결 시 최신 상태 복구)
- **쓰기:** 모든 쓰기는 Next.js API 라우트(Firebase Admin SDK)로만 처리하고, 클라이언트는 보안 규칙으로 허용된 문서만 읽음

## 화면

| 경로 | 설명 |
|---|---|
| `/` | 공통 입장 화면 (6자리 코드) |
| `/s/:publicToken` | 참여자 공유 보드 (직접 링크·QR) |
| `/dashboard` | 강사 대시보드 (Google 로그인) |
| `/instructor/sessions/:id` | 강사 공유 보드 (자료 게시·수정·삭제·고정, 상태 관리) |
| `/instructor/sessions/:id/join` | 프로젝터용 입장 안내 |

## 처음 설정하기

### 1. Firebase 콘솔
1. **Authentication → 로그인 방법 → Google** 사용 설정
2. **Authentication → 설정 → 승인된 도메인**에 Vercel 도메인(예: `linkpium.vercel.app`)과 실제 도메인 추가 (`localhost`는 기본 포함)
3. **Firestore Database** 생성 (프로덕션 모드, 리전 `asia-northeast3` 서울 권장)
4. **Firestore → 규칙**에 `firestore.rules` 내용을 붙여넣고 게시
   (또는 `npx firebase-tools deploy --only firestore:rules`)
5. (권장) **Firestore → TTL 정책**: 컬렉션 `rateLimits`, 필드 `expireAt` 추가 — 입장 시도 기록 자동 삭제
6. **프로젝트 설정 → 내 앱**에서 웹앱 등록 후 SDK 설정값 확인
7. **프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성** (JSON 파일은 저장소에 커밋하지 말 것)

### 2. 로컬 환경변수
`.env.example`을 `.env.local`로 복사해 값을 채웁니다.

```powershell
Copy-Item .env.example .env.local
```

### 3. 실행

```powershell
npm install
```

```powershell
npm run dev
```

http://localhost:3000 접속 → 우측 상단 **강사 로그인** → 강의 생성.

### 4. Vercel 배포
1. 저장소를 Vercel에 연결
2. **Settings → Environment Variables**에 `.env.local`과 같은 값 등록
   (`FIREBASE_PRIVATE_KEY`는 줄바꿈을 `\n` 그대로 붙여넣어도 됨)
3. 도메인을 정하면 `NEXT_PUBLIC_SITE_URL`에 넣고 다시 배포 → 프로젝터 화면·직접 링크·QR에 반영

## 데이터 구조 (Firestore)

| 경로 | 읽기 | 내용 |
|---|---|---|
| `sessions/{id}` | 소유 강사 | 강의 전체 정보, 입장 코드 |
| `boards/{publicToken}` | 누구나(열람 가능 상태일 때, 경로를 알 때) | 제목·설명·드라이브 링크·상태 |
| `boards/{publicToken}/posts/{id}` | 공개 게시물만 / 강사는 전체 | 링크·프롬프트·공지 |
| `joinCodes/{code}` | 서버 전용 | 코드 → 강의 매핑 (문서 ID로 중복 방지) |
| `rateLimits/{ipHash}` | 서버 전용 | 코드 입력 실패 횟수 |

## 개발 명령

```powershell
npm test
```

```powershell
npm run typecheck
```

## 브랜드 적용
색상은 `src/app/globals.css`의 `@theme` 블록, 로고는 `src/components/ui.tsx`의 `Logo` 컴포넌트에 모여 있습니다.
