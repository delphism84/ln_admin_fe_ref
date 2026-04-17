# ln_admin_fe_ref

Niuniu seamless **API 관리자** Next.js 앱입니다.

- **UI 셸**: [Materio](https://themeselection.com/) 스타일 MUI 대시보드 레이아웃 (`ln_admin_fe_ref`의 `reference/`와 동일 구조)
- **업무 화면**: `rc-niuniu-api-fe-next`의 `AdminConsole` / `AdminDateTimeFilter` 통합
- **진입**: 로그인 후 `/niuniu` · 사이드 메뉴 **Niuniu API → Admin Console**

## 스크립트

```bash
npm install --legacy-peer-deps
npm run icons   # Iconify CSS 생성 (최초·아이콘 변경 시)
npm run dev
npm run build   # icons + next build
```

## 환경 변수

`.env.example` 참고. `NEXT_PUBLIC_API_BASE_URL`에 백엔드 API 베이스 URL을 설정합니다.

## Docker

```bash
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://your-api.example -t ln-admin-fe .
```

## 라이선스 참고

Materio 무료 템플릿 기반 화면은 상업 사용 시 ThemeSelection Materio 라이선스 조건을 확인하세요.

## 원격 저장소

https://github.com/delphism84/ln_admin_fe_ref
