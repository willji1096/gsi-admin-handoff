# gsi-admin/ — 최종 납품본 (엔비웨어 퍼블리싱 인수용 · 구 ours-figma, 26-08-21 개명·단일 폴더화)

**이 폴더 하나가 최종본이다.** `v1-approved/`(KT 통과 1차 시안)를 출발점으로 KT 디자인 시스템에 맞춰 정렬한 결과물이며, 바깥 폴더에 의존하지 않는다 — 통째로 복사해 아무 정적 서버(또는 파일 더블클릭)로 열린다. KT 피그마 원본(`GSI_admin.fig` Component_01~04 · 편성표 1:23894)에 맞춰 정렬 중이며, 근거·미적용 항목은 `../기획정의/DS-MATCH-260819.md`.

## 인계 문서
기능 명세 · 더미 ↔ 실데이터 접합 지점 · 보류 기능 · KT 확인 필요 항목은 **`../기획정의/HANDOFF.md`** 에 있다.
KT 수정요구 반영 현황은 이 폴더의 **`HANDOFF-KT-260820.md`**(8/20 14건) · **`HANDOFF-KT-260824.md`**(8/24 10건 + 8/25 후속) · **`HANDOFF-KT-260828.md`**(8/27 6건 + 8/28 10건).
개발 인수는 이 README(폴더 지도) → HANDOFF(기능·데이터) → KT 요구 문서 2장 순으로 읽으면 된다.

## 진입
`schedule.html`(편성표) → 담기 → 분석하기 → `analysis.html`(상세) → ← 편성표. GNB "실시간 현황" → `realtime.html`.

## 파일
| 파일 | 역할 |
|---|---|
| `schedule.html` + `app.js` | 편성표 화면·로직(편성 생성기·바구니·타임라인/리스트 뷰) |
| `analysis.html` | 상세 분석 — KT 원본 캡처(Next.js 정적 번들) 위에 우리 헤더·탭·차트를 주입한 구조. 피그마 스킨 **항상 켜짐**(`window.__gsiFigma = true`) |
| `realtime.html` | 실시간 현황 — 구 DS 이식본(리스킨 미결, 참고용) |
| `tokens.css` | GSI 공식 토큰(색·타이포·그림자) — **신규 hex 금지**, 차트 팔레트만 예외 |
| `ui.css` | 편성표 본체 스타일 |
| `ui-figma.css` | 편성표 피그마 정렬 오버라이드(`ui.css` 위에 얹음) — 체크칩 r20·GNB·radio tab·날짜 배지·위로가기·탭 하단선 `--line-tab`·시간축 14 |
| `kt-skin.css` → `kt-skin-figma.css` | 상세 본체 스킨 → 피그마 정렬 오버라이드(담은 프로그램 칩 32h r20·섹션 라인 탭·GNB) |
| `icons-figma.js` | 아이콘 세트 — 피그마 원본 벡터 + Iconsax linear, `app.js` ICON 맵을 덮음 |
| `HANDOFF-KT-260820.md` · `HANDOFF-KT-260824.md` | KT 수정요구 반영 현황 + 개발사 몫 |
| `components.html` + `components.css` | **컴포넌트 시트** — 피그마 라이브러리 30종 노드 실측 1:1 (버튼·칩·탭·배지·Input 6상태·검색바·체크/라디오/토글·메뉴·툴팁·popup·조회바·위젯·빈상태·로딩) + 우리 신규 컴포넌트 |
| `assets/` | 로고·아이콘 svg, 홈쇼핑사 로고(`brand/`), 상품 사진(`products/`), `charts.js`·`motion.js`, 구판 `tokens.css`/`ui.css`(realtime 전용) |

## 퍼블리셔 참고
- CSS 적용 순서(편성표): `tokens.css` → `ui.css` → `ui-figma.css`. (상세): 본체 인라인 → `kt-skin.css` → `kt-skin-figma.css`. 오버라이드 층은 `!important` 를 쓰므로 최종값은 `components.html` 시트와 DS-MATCH 표를 기준으로 읽을 것
- `analysis.html` 콘솔의 `_next/static/.../layout.css` 404 · `__nextjs_original-stack-frames` 501 은 KT 원본 번들 잔재(동결) — 화면 영향 없음
- 폰트 Pretendard 는 jsDelivr CDN. 오프라인 납품이면 `assets/` 에 내려받아 `<link>` 교체
- 의도적으로 피그마와 다르게 둔 3곳: 편성 블록 64h(피그마 80) · 채널명 14(16) · 시간축 44h(60) — 레일 밀도 때문. 아래 매칭 현황 참조

## 매칭 현황 (26-08-19 2차 — 편성표 화면 1:23894 노드 실측 ↔ DOM 기계 대조)

검증 방법: `.fig` 디코드 → 화면 프레임을 노드 단위로 덤프(크기·패딩·gap·색·폰트) → Playwright 로 DOM 계산값 추출 → 항목별 `===` 비교. 1차(컴포넌트 요약표 눈대중)에서 ✅ 로 적었다가 2차에서 틀린 걸로 드러난 항목: GNB 좌 패딩(48), 카드 그림자 블러(30), 칩 간격(12)·좌 패딩(8)·on 색(#5A64FF), 전체선택 높이(34), 날짜 필 패딩(24)·gap(6)·글자색, sub 버튼 굵기(Regular), 버튼 자간(−0.5), 탭 하단선(#E1E6EF), 위로가기 그림자(있음), 채널번호 칩(13 SemiBold pad 6).

- ✅ 기계 대조 통과(25): GNB(60·pad 48/24·로고→메뉴 60·탭 gap 8 pad 10 18px·우측 16 gap 22·아이콘 gap 16) · 타이틀 24 Bold · 카드 r12 그림자 10/20/30 4% · 체크칩(32 r20 좌8/우16 gap0 틱24 14 SemiBold, off #D6DDE9/#353A41/#A7B1BF, on #5A64FF 10%/#5A64FF) · 칩 gap 12 · 전체선택 34 r6 #F8F9FF pad 16 · 날짜 필 44 r50 #F8F9FF pad 24 gap 6 14 #353A41 · dash #353A41 · Button Default 48 r8 pad 24 #6941FF Bold 16 ls −0.5 · sub #E5EAFF #58606A Regular 16 · radio tab 44 r24 pad 4 gap 6 / 36 r26 pad 18 on #6941FF SemiBold 14 · 스테퍼 34 r6 #F8F9FF · 날짜 배지 21 r6 pad 7 12 SemiBold #353A41/#C85CF2 · 채널번호 칩 20h r4 pad 6 13 SemiBold · 탭 54h 16 Regular #7A8490 / Bold #1D1D1D 1px 밑줄 · 탭 행 하단선 #E1E6EF · 위로가기 48 원형 #D6DDE9 보더 + 그림자 3/8/10 10% 화살표 #5A64FF · 푸터 #D6DDE9 pad-l 48 로고 74 gap 40 링크 14 #353A41 카피 13 #7A8490 · 바닥 #F8F9FF · Pretendard ls −0.5
- 폰트 전수(22 역할) ✅: 타이틀 24 Bold · 카드 제목 20 Bold(조회바 타이틀 1:24203) · 필터 라벨 16 Regular #1D1D1D · 칩 14 SemiBold · 전체선택 14 · 날짜 필 14 · 버튼 16 Bold/Regular · 탭 16 · radio tab 14 · 배지 12 SemiBold · 채널번호 13 SemiBold · 블록 제목 14 SemiBold #58606A · 블록 캡션 13 · 시간축 14 #353A41 · 푸터 14/13
- 의도적 차이(3): 편성 블록 64h 히트 틴트(피그마 80h #F1F3FF) · 채널명 14 SemiBold(피그마 16 Bold — 레일 폭) · 시간축 44h(피그마 60h — 레일 밀도, 시각 14 는 정렬)
- 보류: GNB 민트 #12DB91(로컬 fig) vs #00EEAE(라이브 실측)
- 아이콘: 피그마가 쓰는 세트 = Iconsax linear(24그리드 stroke 1.5). 겹치는 4종은 .fig 벡터 그대로, 나머지는 같은 세트에서 대응 아이콘. 유지(세트 무관 기본형): ×·로더 호
- 피그마에 없음 → 신규 컴포넌트(7): 라인 탭 · 테이블 · 상태칩 · 바구니 바 · 비교 시트 · 미니맵 · 스파크라인
- 상세(analysis) 그래프 색은 KT 파스텔 원색 유지 — DS 가 파스텔로 바뀌어도 그래프는 불변

## 점수 (26-08-20 — "피그마에 있는 것 중 맞출 수 있는 전부 = 100")

| 영역 (가중치) | 전 | 후 | 근거 |
|---|---|---|---|
| 토큰 (10) | 9 | 9 | GNB 민트 #12DB91/#00EEAE 미확정 |
| 편성표 컴포넌트 치수·색 25항목 (20) | 18 | 18 | 의도적 차이 3(블록 64h·채널명 14·축 44h), 축약 좌우 버튼은 시트에만 |
| 편성표 폰트 (10) | 7 | 10 | 자간 0 정렬(버튼·GNB·푸터 링크만 −0.5) |
| 아이콘 (10) | 9 | 9 | ×·로더는 세트 밖 |
| 상태 hover/pressed/disabled (10) | 5 | 8 | disable 색, 칩/버튼 hover, Input 6상태(시트). pressed 변형은 피그마에 치수·색 차이 없음 |
| 화면 구조·간격 (10) | 5 | 5 | 조건 6종 카드 구조는 의도적 — 미대조 |
| 컴포넌트 라이브러리 커버리지 (15) | 5 | 14 | components.html 30종 실측 구현. 토글 knob 색만 .fig 에서 확정 불가 |
| 상세 페이지 (10) | 4 | 8 | 피그마에 '결과' 화면은 없음 → 헤더 존·GNB·gotop·탭칩·카드·글자색·12 최소 정렬. KT 차트 영역은 대조 대상 없음 |
| 실시간 페이지 (5) | 0 | — | 납품 범위(편성표+상세 2장) 밖 · 구 자산 기반 → 가중치에서 제외 |
| **합계** | 62 | **81 / 95** (실시간 제외 시 95 만점) ≈ **85점** | |
