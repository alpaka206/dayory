# 버팀목

Notion에 쌓아둔 문장을 책장 넘기듯 읽고, 마음에 남는 문장은 저장해두는 개인형 문장집입니다.

## 서비스 개요

- 문장만 한 장씩 넘기며 읽습니다.
- Notion 데이터는 초기 로딩 때 메타만 먼저 받고, 본문은 필요한 시점에만 불러옵니다.
- 마음에 드는 문장은 저장함에 모아 다시 볼 수 있습니다.
- 상단 YouTube 플레이어로 읽는 흐름에 맞는 플레이리스트를 함께 재생할 수 있습니다.

## 주요 기능

- 홈 화면
  - 책처럼 펼쳐지는 문장 리더
  - 이전/다음 탐색
  - 모바일 가로 스와이프 탐색
  - 현재 문장 주변만 미리 로드하는 지연 로딩
  - 선택한 문장 저장
- 저장함
  - 저장한 문장 목록 확인
  - 최신 날짜 우선 정렬
  - 한 번에 전부 불러오지 않고 `12개`씩 점진적으로 표시
- 음악 플레이어
  - 재생 / 일시정지 / 이전 / 다음
  - 마지막 곡 위치 기억
  - 중복 링크 제거
  - 재생 오류 시 다음 곡으로 자동 이동

## 기술 스택

- React 19
- TypeScript
- Vite
- React Router
- `notion-client`
- YouTube IFrame API

## 데이터 구조

서비스는 Notion 데이터베이스 페이지를 기준으로 동작합니다.

필수 속성:

- `title`
- `author`
- `date`

선택 속성:

- `type`
- `theme`

## 동작 방식

### Notion 로딩

- 클라이언트는 먼저 메타 목록만 가져옵니다.
- 본문은 현재 보고 있는 문장과 인접 문장만 추가 요청합니다.
- 저장함도 현재 보이는 범위만 본문을 가져옵니다.

### 캐싱

- 클라이언트 메타 캐시: `localStorage`
- 서버 메모리 캐시: 테이블/본문 각각 별도 TTL 적용
- HTTP 캐시 헤더: `stale-while-revalidate` 적용

## 프로젝트 구조

```text
src/
  components/        UI 컴포넌트
  constants/         플레이리스트, 상수
  hooks/             엔트리/좋아요/플레이어 상태 훅
  lib/               Notion, YouTube 유틸
  pages/             라우트 페이지
server/
  notion-service.ts  Notion 캐시 및 응답 가공
  notion-middleware.ts
api/
  notion/            배포용 API 엔드포인트
```

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 만들고 아래 값을 설정합니다.

```bash
VITE_NOTION_PAGE_ID=<your_notion_page_id>
```

주의:

- 대상 Notion 페이지는 외부 공개 접근이 가능해야 합니다.
- 데이터베이스에는 `title`, `author`, `date` 속성이 있어야 합니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

### 4. 프로덕션 빌드

```bash
npm run build
```

### 5. 정적 분석

```bash
npm run lint
```

## 검증 상태

현재 저장소에는 별도의 unit test / e2e test 스크립트가 없습니다.

커밋 전 수행한 검증:

- `npm run lint`
- `npm run build`
