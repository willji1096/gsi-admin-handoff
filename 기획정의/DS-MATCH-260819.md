# 디자인 시스템 매칭표 — GSI_admin.fig DS ↔ gsi-admin/ (26-08-19)

_적용 전 매칭만. 출처: `GSI_admin.fig-dump-260819.md`(로컬 .fig 2024-02 디코딩) + FIGMA.md 라이브 재실측(26-08-12). 판정: ✅ 동일 · 🟡 근접(수치 차이) · 🔴 다름 · ➕ 우리에만 있음(피그마 컴포넌트 없음) · ➖ 피그마에만 있음(우리 미사용)._

## A. 토큰

| 토큰 | 피그마 DS | ours (`tokens.css` / `ui.css` 별칭) | 판정 |
|---|---|---|---|
| white / gray100~600 / black | #FFFFFF · #F8F9FF · #D6DDE9 · #A7B1BF · #7A8490 · #58606A · #353A41 · #1D1D1D | 동일 (`--white`…`--black`) | ✅ |
| genie purple | #6941FF | `--genie-purple` #6941FF | ✅ |
| genie blue | #5A64FF | `--genie-blue` #5A64FF | ✅ |
| sub-blue | #E5EAFF | `--sub-blue` | ✅ |
| secondary lightblue/skyblue/purple/green/orange/yellow | #F1F3FF · #5AACF5 · #C85CF2 · #12DB91 · #FF8F6B(스타일 #FF8F6E 혼재) · #FFD232 | `--sec-*` 동일 (orange = #FF8F6E) | ✅ (orange 6B/6E 는 피그마 내부 혼재) |
| GNB 그라데이션 | 90° #6A42FF 0 → #5832E8 67% → #6A42FF 100 | `--gnb-gradient` #6941FF→#5B35ED→#5832E9→#6941FF | 🟡 중간 스톱 표현만 다름, 시각 동일 |
| GNB 활성 민트 | **#12DB91** (로컬 Menu_tab on) / #00EEAE (라이브 실측 기록) | `--gnb-mint` #00EEAE | 🔴 **라이브 파일 재확인 필요** — 어느 쪽이 최신인지 |
| GRAPH light 01~17 | 41B0E0 … E7C2D5 | `--graph-01~17` 동일 | ✅ (18~20: ADC78F 9186BA 8ECCC4 — tokens.css 미등록) |
| GRAPH dark 01~17 | 4679B2 … E7C2D5 | 없음 | ➖ 다크모드 미지원이라 불필요 |
| 타이포 스케일 | H1 34 / H2 30 / H3 22 / H4 20 / T1 18 / T2 16 / B1 14 / B2 13 / B3 12 · lh 1.4 · ls −0.5 | `--h1…--body-3` 동일 | ✅ |
| 카드 그림자 | 스타일 "Drop Shadow" 0/5/10 #F1F2FA 100% · 차트 카드 5/10/20 #000 5% · 조회바 10/20/30 #000 4% | `--shadow-card` 10/20/15 rgba(0,0,0,.04) (라이브 1:48752 실측) | 🟡 피그마 안에서도 3종 혼재 — 라이브 실측값 유지 |
| 라운드 | 카드 12 · 버튼/블록/조회바 8 · 칩 20 · 배지 6 · 입력 필 50 · 채널번호 4 · 팝업 26 | 카드 12 · 버튼 8 · 칩 **16** · 배지 6 · 필 22(pill) · 채널번호 4 | 🟡 칩 16→20 만 차이 |

## B. 컴포넌트

| 컴포넌트 | 피그마 (규격) | ours (클래스 · 규격) | 판정 / 메모 |
|---|---|---|---|
| GNB | 1920×60, pad-l 24, 로고 120×44, 메뉴 gap 8, 탭 텍스트 **18** Bold/Regular 흰, on = 민트 텍스트+하단 2px, hover 흰 5% 바탕. 우측 시각 16 · 구분선 12×1 · 아이콘 24×3 gap 16 · 프로필 아바타 24 + 이름 16 SemiBold | `.gnb` 60, pad 0 20 0 28, 로고 120×44, 탭 **16**(`--title-2`) pad 13, on = `--gnb-mint` + 2px, hover 없음(색만), 우측 14 · vline 12 · 아이콘 24×3 gap 12~16 · 아바타 24 + 이름 14 | 🟡 폰트 18 vs 16, 우측 텍스트 16 vs 14, hover 바탕 없음 |
| Button Default | 48h r8 pad 24 #6941FF 흰 Bold 16, hover opacity .6 | `.btn--primary` 48 r8 pad 24 #6941FF, hover = 85% 어둡게 | 🟡 hover 규칙만 다름 |
| Button sub | 48h r8 #E5EAFF / #58606A Regular 16 | `.btn--soft` 48 r8 `--sub-blue` / `--ink-3` | ✅ |
| Button disable | #D6DDE9 / #A7B1BF | `.btn.is-disabled` opacity | 🟡 색 지정 vs 불투명도 |
| Button large 272w | 272×48 | 없음(폭 가변) | ➖ |
| button_small / xsmall | 46h r6 #F8F9FF SemiBold 14 / 34h r6 #F8F9FF Regular 14 | `.btn--ghost`(48) · `.daystep__btn` 32 r6 · `.seg` 32 r6 | 🟡 비슷한 자리. 32 vs 34 |
| 체크칩(채널사·카테고리) | 32h **r20** pad 16, 체크 24 + SemiBold 14; off 보더 #D6DDE9 텍스트 #353A41; **on 바탕 #5A64FF 10% + 보더 #5A64FF + 텍스트·체크 #5A64FF**(26-08-19 재확인: Property 1=on 노드 1:2149 — 보더/텍스트 모두 Genieblue 스타일). 좌 8 · 체크 24 · gap 0 · 우 16 (85×32 "홈쇼핑"); hover opacity .7; category 변형 ▾ | `.chip` 32 r16 pad 12, 틱 12 + 13(`--body-2`); off 보더 line 텍스트 ink-3; on 흰 바탕 + 보더 brand + 텍스트 brand 600; hover opacity .7 | 🔴 **r16→20, on 틴트 바탕, 텍스트 14 SemiBold, 틱 24** |
| 범례 칩(button_badge) | 28h r20 pad 10/4, default #F8F9FF 텍스트 #7A8490 13, select 시리즈색 10% 바탕 | 우리 차트 범례 없음(KT 차트 사용) | ➖ |
| radio tab(세그먼트) | 44h r24 #F8F9FF pad 4, 아이템 36h r26, on #6941FF 흰 SemiBold 14 / off #353A41 Regular 14 | `.seg` 32h r6 사각 보더형, on 연보라 바탕+보라 보더 | 🔴 **형태 자체가 다름(필 vs 사각)** — 채널 순서 `구분|번호순` 을 radio tab 으로 바꿀 후보 |
| uvpv_tab | 44h r23, 아이템 38h r30 | 없음 | ➖ |
| Tab(언더라인 탭) | 피그마 admin 파일엔 라인탭 컴포넌트 없음(서브메뉴는 22 Bold/Medium 텍스트 전환) | `.tabs` 54h, 16, 활성 2px 밑줄 | ➕ (라이브 편성표 1:23894 장르탭 실측 근거) |
| Input/Textfield | 48h r8 #F8F9FF pad 16/12, hover 보더 #A7B1BF, error #FF8F6E, disabled #D6DDE9, 라벨 16 Bold | `.input` 40 r6 흰 보더 line-strong · `.pill` 44 r22 #F8F9FF | 🟡 조회 필은 피그마 조회바 규격(44 r50 #F8F9FF)과 ✅, 일반 input 은 40 vs 48 |
| 조회 조건 바 | 1824×82 흰 r8 그림자, pad 24/17, 라벨 14 SemiBold(+12 보조), 필 44 r50, 우측 조회 48 | `.filters` 카드(r12) + `.filter-row` 라벨 + `.pill` 44 + `.btn--primary` 48 | 🟡 우린 카드 안 다행(조건 6종)이라 구조 다름, 요소 규격은 ✓ |
| 캘린더 | radio tab(월/주/일…) + 두 날짜 필 + 월 그리드 776×991 | `.cal` 300w r8 그림자, 셀 34 r6, 선택 #6941FF, 범위 틴트 | 🟡 규격 소형화. 셀 색 규칙 동일 |
| Tooltip | 80×40 8종(아이콘 툴팁) · 데이터 툴팁 232×85 | `.tip` 검정 r8 12px · `.pop` 팝오버 320 | 🟡 아이콘 툴팁만 대응. 데이터 팝오버는 ➕ |
| 체크박스 / 라디오 / 토글 | 체크 24(안 20 r4 on #5AACF5 / off #D6DDE9) · 라디오 18 보더 2 on #6941FF / off #A7B1BF · 토글 34×20 on #6941FF | 체크박스·토글 없음, 칩 틱으로 대체 | ➖ (비교 시트 선택 등에 쓸 수 있음) |
| Badge | 21h r6 pad 7, 12 SemiBold 흰: 날짜 #353A41 · 다음날 #C85CF2 · Now #6941FF | `.tl__date` 22h r4 `--ink-2` / 다음날 `--brand` · `.tl__onair` 16h r3 alert | 🟡 라운드 4→6, 다음날 색 brand vs #C85CF2, Now = 우리 ON AIR(빨강) |
| 채널번호 칩 | 20h r4 #353A41 pad 6/1 + 채널명 16 Bold | `.tl__ch .no` + `.name` | ✅ |
| 편성 블록 | 80h r8 #F1F3FF pad 16/12, 제목 14 SemiBold #58606A, 시계 16 + 시간 13, `상세보기 ›` 22h r4 #D6DDE9, **방송 중 #5AACF5 흰 텍스트** | `.tl__blk` 64h r8 흰+보더, 제목 14 600, 시간 12, 히트 틴트 l2/l3, ON AIR 배지 | 🟡 **의도적 변경**(가치 인코딩) — 유지 |
| 타임라인 시간축 | 60h, 시각 14 Regular, 7px 눈금 #D6DDE9 | `.tl__axis` 44h, 시각 14(ui-figma 오버라이드), 틱 | 🟡 높이 44 는 레일 밀도 때문에 의도적 유지 |
| chart_title | 56h pad 16, 제목 16 Bold + ⓘ 24, 우측 아이콘 24×3 gap 12 | `.card__head h2` 18 + 아이콘 | 🟡 우린 카드 헤더 18 |
| 카드 | r12 흰 + 그림자 / 차트 카드 r12 보더 #F8F9FF | `.card` r12 그림자, 보더 0 | ✅ |
| 테이블 | 피그마 admin 에 테이블 컴포넌트 없음(상품별 성과분석 프레임 안 표만) | `.table` th gray100 13/600, td 14, 12px pad | ➕ |
| 팝업(모달) | 514w r26 #F8F9FF pad 40/36 | 없음(리포트 모달 제거됨) | ➖ |
| 메뉴_팝업(드롭다운) | 143w r12 흰, pad-b 12 | 상세 analysis 스위처 리스트(삭제됨) | ➖ |
| 로딩 | 70×70 4프레임 | `.stat--pending` 로더 회전 | ➕ |
| 빈 상태 | ic_emptydata/emptychart 72 | 편성표 `resCount` 0 텍스트만 | 🟡 아이콘 도입 후보 |
| 위로가기(ic_gotop) | 48 원형 흰 + 보더 #D6DDE9 | `.totop` / `.kttop` 44 원형 흰 보더 + 그림자 | 🟡 44→48, 그림자 제거 |
| 푸터 | 220h #D6DDE9, kt 로고 74, 링크·사업자 정보 | `.kt-footer` 28 pad, 동일 구성 | ✅ (높이만 콘텐츠형) |
| 페이지 폭 | 컨텐츠 1824 (48 여백) | `.page-wrap` 1824 / 48 | ✅ |
| 상태칩(확정·잠정·집계 중) | 없음 | `.stat` 22h r4 | ➕ |
| 분석 바구니 바 · 비교 시트 · 미니맵 · 스파크라인 | 없음 | ➕ 우리 발명 | ➕ |

## C. 맞추기 후보 (우선순위 제안 — 적용은 나중에)
1. **체크칩** r20 · on 틴트 바탕 · 텍스트 14 SemiBold · 틱 24 — 편성표 조회 조건 전면, 체감 가장 큼
2. **GNB** 탭 18px · 우측 16 · hover 흰 5% — 두 페이지 공통 (활성색은 라이브 확인 후)
3. **세그먼트(`구분|번호순`)** → radio tab 필 형태(44h r24, on #6941FF)
4. 날짜/다음날 **Badge** r6 · 다음날 #C85CF2
5. 위로가기 48 · 빈 상태 아이콘 · chart_title 16
6. 라이브 파일에서 재확인: GNB 민트(#12DB91 vs #00EEAE), 칩 on 바탕, 카드 그림자 정본
