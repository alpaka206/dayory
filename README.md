# 틈

Notion에 쌓아둔 문장과 기록을 가볍게 읽고, 저장하고, 음악과 함께 머무를 수 있게 만든 개인형 뷰어 서비스입니다.

## 서비스 개요

- `문장`과 `기록`을 탭으로 나눠 읽습니다.
- Notion 데이터를 가져오되, 초기 로딩은 메타만 먼저 받고 본문은 필요한 시점에만 불러옵니다.
- 마음에 드는 글은 저장함에 모아 다시 볼 수 있습니다.
- 상단 YouTube 플레이어로 서비스 분위기에 맞는 플레이리스트를 함께 재생할 수 있습니다.

## 주요 기능

- 홈 화면
  - `문장 / 기록` 탭 전환
  - 이전/다음 탐색
  - 현재 글 주변만 미리 로드하는 지연 로딩
  - 선택한 문장 저장
- 저장함
  - 저장한 글 목록 확인
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
- `type`
- `author`
- `date`

`type` 값은 현재 `quote` 또는 `journal`을 기대합니다.

## 동작 방식

### Notion 로딩

- 클라이언트는 먼저 메타 목록만 가져옵니다.
- 본문은 현재 보고 있는 글과 인접 글만 추가 요청합니다.
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
- 데이터베이스 스키마는 위의 `필수 속성` 구조를 따라야 합니다.

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

참고:

- 샌드박스 환경에서는 `vite preview`가 `spawn EPERM`으로 막힐 수 있습니다.
- 일반 로컬 터미널에서는 `npm run preview`로 최종 번들 확인을 권장합니다.

## 운영 메모

- 홈 화면 기본 성능은 `메타 우선 로딩 + 본문 지연 로딩`에 맞춰 설계되어 있습니다.
- 저장함에 항목이 많아져도 첫 렌더에서 모든 본문을 한 번에 가져오지 않습니다.
- Notion 응답 속도가 느린 경우에도 캐시가 채워진 뒤부터는 체감 응답 속도가 크게 개선됩니다.

## 앞으로 해볼 만한 일

- unit test / e2e test 추가
- README용 실제 서비스 스크린샷 추가
- Notion 스키마 검증 메시지 개선
- 플레이리스트를 계절/무드별 preset으로 분리
- 저장함 검색/필터 추가
