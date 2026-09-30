# EMPECS CGMS 관리자 콘솔

회원·기기(SN/QR)·운영을 관리하는 어드민 FE. 백엔드는 `empecs_cgms_be` 의 `/api/admin`
(계약: BE 저장소 `docs/admin_api.md`).

- Next.js 14 (App Router, standalone) · TypeScript · Tailwind + daisyUI(라이트/다크) · recharts · qrcode
- 셸·메뉴·공통 부품 구성은 games_card 통합어드민(admin-ui)을 참고했다.

## 메뉴

| 메뉴 | 경로 | 내용 |
|---|---|---|
| 대시보드 | `/dashboard`, `/dashboard/world` | 센서·회원·동기화 요약, 추이 차트, 실시간 기기, 국가별 현황 |
| 회원 관리 | `/users`, `/users/[id]` | 검색·정렬·내보내기, 상세(센서·혈당 그래프·이벤트·알람·로그인 이력), 정지·강제 로그아웃·탈퇴·삭제 |
| 기기 관리 | `/devices`, `/devices/[serial]` | SN 재고, 상태(재고·출고·사용 중·만료·차단), 소유권 해제·이전, 시작시각 정정, 이력 |
| | `/devices/register` | 단건 등록 · SN 범위 생성 · CSV 가져오기 |
| | `/devices/lots`, `/devices/qr`, `/devices/ending` | 로트, QR 라벨 인쇄, 종료 예정(실시간) |
| 동기화 감시 | `/monitor` | 센서 사용 중인데 업로드가 끊긴 회원 |
| 데이터 관리 | `/data` | 혈당 조회·내보내기·삭제 |
| 공지사항 | `/notices` | 앱에 노출되는 공지 |
| 시스템 | `/system/admins`, `/system/audit`, `/system/logins`, `/system/settings` | 관리자 계정·역할, 감사 로그, 로그인 이력, 설정 |

메뉴와 버튼은 로그인한 관리자의 권한에 따라 숨겨진다(실제 차단은 서버가 한다).

## 구조

```
src/lib/           api.ts(401 처리·오류 문구) auth.tsx(권한) useList.ts dialog.ts toast.ts format.ts
src/components/ui  adm.tsx(PageTitle·Kpi·Panel·Pill) DataTable Modal DialogHost
src/components/layout  navConfig.ts(메뉴 정의) AdminShell.tsx
src/app/(main)/    화면
```

## 개발

```bash
# BE: 메모리 DB + 시드 데이터 (empecs_cgms_be 저장소에서)
npm run dev:memory            # http://127.0.0.1:58113, 로컬 관리자 계정은 기동 로그에 출력

# FE
echo "API_PROXY_TARGET=http://127.0.0.1:58113" > .env.local
npm install && npm run dev
```

`npm run typecheck` · `npm run build`

## 배포

BE 저장소의 `docker-compose.yml` 이 이 저장소를 `../cgms_admin_fe` 로 빌드한다(`API_PROXY_TARGET=http://be:58002`).
