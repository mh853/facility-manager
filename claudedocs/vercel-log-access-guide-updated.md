# Vercel 로그 접근 가이드 (업데이트)

**업데이트**: 2026-01-14
**대상**: facility-manager 프로젝트 API 로그 확인

---

## 🎯 핵심 요약

**결론**: Functions 탭이 없는 것은 정상입니다. **Runtime Logs**에서 API 로그를 확인할 수 있습니다.

---

## 📍 Step 1: Runtime Logs 접근

### 현재 보이는 화면에서:

```
1. 상단 탭 메뉴에서 "Runtime Logs" 버튼 클릭
   (스크린샷에 보이는 "Build Logs" 오른쪽)

   또는

2. "Observability" 탭 클릭 → "Function Invocations" 섹션
```

**스크린샷 기준**:
```
현재 위치: Overview 탭
이동 경로:
→ "Runtime Logs" 버튼 (우측 상단, Build Logs 옆)
→ 또는 "Observability" 탭 클릭
```

---

## 📊 Step 2: Runtime Logs에서 확인할 내용

### 2.1 로그 필터 설정

**URL 필터**:
```
/api/subsidy-crawler
```

**시간 범위**:
```
2026-01-12 ~ 2026-01-14 (최근 3일)
```

**로그 레벨**:
```
All Logs (또는 Errors & Warnings)
```

---

### 2.2 검색 키워드

#### 🔴 타임아웃 확인
```
검색: "timeout" 또는 "duration" 또는 "exceeded"
```

**기대 결과**:
```
✅ 타임아웃 발생 시:
Duration: 10000ms (TIMEOUT)
Function execution exceeded time limit

❌ 타임아웃 없음 시:
Duration: 2500ms
Duration: 5432ms
```

---

#### 🟡 Phase 2 크롤링 로그
```
검색: "CRAWLER-P2" 또는 "enable_phase2" 또는 "phase2"
```

**기대 결과**:
```
✅ 정상 실행 시:
[CRAWLER-P2] 31개 환경센터 크롤링 시작
[CRAWLER-P2] 배치 1: 8개 센터 처리
[CRAWLER-P2] 경기환경에너지진흥원 크롤링 시작

❌ 에러 발생 시:
[ERROR] PHASE2_SOURCES is undefined
[CRAWLER-P2] No sources in batch
```

---

#### 🟢 에러 메시지
```
검색: "ERROR" 또는 "Failed" 또는 "error"
```

---

## 🔍 Step 3: Observability 탭 활용

### 3.1 Observability 탭으로 이동

**경로**:
```
상단 탭: Overview → Observability
```

**확인 항목**:
```
1. Function Invocations (함수 호출 횟수)
   → subsidy-crawler 호출 빈도
   → 성공/실패 비율

2. Function Duration (실행 시간)
   → 평균 실행 시간
   → 최대 실행 시간
   → 10초 초과 여부

3. Error Rate (에러율)
   → Phase 2 에러율
   → Government 크롤러 에러율 비교
```

---

## 📋 Step 4: 특정 실행 로그 찾기

### 4.1 실패한 실행 찾기

**모니터링 대시보드에서 확인한 실패 시각**:
```
❌ run_phase2_2026-01-13T04-11-13
   → 실제 실행 시각: 2026-01-13 04:11:13 (UTC)
   → 한국 시각: 2026-01-13 13:11:13 (KST)
   → Vercel 로그 시각: UTC 기준으로 표시됨

❌ run_phase2_2026-01-13T04-11-12
   → 실제 실행 시각: 2026-01-13 04:11:12 (UTC)
```

**Runtime Logs에서 검색**:
```
1. 시간 필터: 2026-01-13 04:10:00 ~ 04:12:00
2. URL 필터: /api/subsidy-crawler
3. Method: POST
4. 해당 시각의 로그 클릭 → 상세 보기
```

---

### 4.2 성공한 Government 크롤링 찾기

**모니터링 대시보드에서 확인한 성공 시각**:
```
✅ run_government_2026-01-13T03-55-15
   → 실제 실행 시각: 2026-01-13 03:55:15 (UTC)
```

**Runtime Logs에서 검색**:
```
1. 시간 필터: 2026-01-13 03:55:00 ~ 03:56:00
2. URL 필터: /api/subsidy-crawler
3. Body에 "enable_phase2": false 또는 없음
```

---

## 🎯 간단한 대안: Deployments 탭 활용

스크린샷에 보이는 화면에서 바로 확인할 수 있는 방법:

### 방법 1: 최근 배포의 Runtime Logs

```
1. 현재 화면 (Overview)에서 "Runtime Logs" 버튼 클릭
   (Build Logs 옆, 우측 상단)

2. 최근 로그 목록 표시됨

3. POST /api/subsidy-crawler 로그 찾기

4. 로그 클릭 → 상세 내용 확인
```

---

### 방법 2: Deployments 탭에서 확인

```
1. 상단 탭: Overview → Deployments

2. 최근 배포 선택 (예: main 브랜치, 19h ago)

3. "Logs" 버튼 클릭 (배포 상세 페이지 내)

4. Runtime Logs 탭 선택

5. subsidy-crawler 관련 로그 검색
```

---

## 💡 Functions 탭이 없는 이유

### Vercel의 Functions 개념

**Vercel에서 "Functions"는**:
```
1. API Routes (app/api/**/route.ts)
2. Server Actions
3. Serverless Functions

→ 별도 "Functions" 탭이 없고
→ "Runtime Logs"에서 모든 함수 실행 로그 확인
→ "Observability"에서 함수별 통계 확인
```

**GitHub Actions는**:
```
1. 크롤러 실행을 트리거하는 스케줄러
2. Vercel API를 호출하는 클라이언트
3. GitHub에서 워크플로우 로그 확인 가능

→ GitHub Actions 로그 ≠ Vercel 함수 로그
→ 두 곳 모두 확인 필요
```

---

## 🔬 핵심 확인 사항 (우선순위)

### 1순위: Runtime Logs에서 Duration 확인

**목표**: 10초 초과 여부 확인

```
Runtime Logs → subsidy-crawler 로그 클릭 → Duration 값 확인

기대값:
✅ Government: 2000-5000ms (2-5초)
❌ Phase 2: 10000ms+ (10초 이상) → 타임아웃!
```

---

### 2순위: 에러 메시지 확인

**목표**: 실패 원인 파악

```
Runtime Logs → "ERROR" 검색

기대 메시지:
- "Function execution timeout"
- "PHASE2_SOURCES is undefined"
- "Failed to update crawl_run"
- "Supabase error"
```

---

### 3순위: Observability에서 패턴 확인

**목표**: 전체 실패율 확인

```
Observability 탭 → Function Invocations

확인:
- subsidy-crawler 총 호출 횟수
- 성공/실패 비율
- 평균 실행 시간
- 에러율
```

---

## 📸 수집 필요 스크린샷 (업데이트)

### ✅ 필수 체크리스트

#### Runtime Logs
- [ ] Runtime Logs 전체 화면
- [ ] Phase 2 실행 로그 (2026-01-13 04:11:13 UTC)
- [ ] Duration 값 표시된 로그
- [ ] 에러 메시지 (있다면)

#### Observability
- [ ] Function Invocations 그래프
- [ ] Function Duration 그래프
- [ ] Error Rate 통계

#### 개별 로그 상세
- [ ] 실패한 Phase 2 로그 상세 보기
- [ ] Request body (enable_phase2, batch_num 등)
- [ ] Response status
- [ ] Console logs ([CRAWLER-P2] 로그)

---

## 🎯 빠른 진단 (Runtime Logs만으로)

Runtime Logs에서 다음 3가지만 확인하면 원인 파악 가능:

### 체크리스트

```
1. Duration 값
   - [ ] 10초 미만 (정상)
   - [ ] 10초 정확히 (타임아웃)
   - [ ] 10초 초과 불가 (Vercel 강제 종료)

2. 에러 메시지
   - [ ] "timeout" 관련 에러
   - [ ] "PHASE2_SOURCES" 관련 에러
   - [ ] "Supabase" 관련 에러
   - [ ] 에러 없음

3. Console logs
   - [ ] [CRAWLER-P2] 로그 보임
   - [ ] [CRAWLER-P2] 로그 없음
   - [ ] [DEBUG] 로그 보임 (있다면)
```

---

## 🚀 다음 단계

Runtime Logs 확인 후:

### 시나리오 A: Duration = 10000ms (타임아웃)
**원인 확정**: Vercel 10초 제한 초과
**해결**: 배치 크기 8 → 4로 축소
**소요 시간**: 30분
**예상 효과**: 성공률 0% → 90%

### 시나리오 B: Duration < 10000ms, 에러 있음
**원인**: 크롤링 또는 DB 에러
**해결**: 에러 메시지에 따라 대응
**소요 시간**: 1-2시간

### 시나리오 C: 로그 자체가 없음
**원인**: API 호출이 Vercel에 도달 안 함
**해결**: GitHub Actions → Vercel 연결 확인
**소요 시간**: 1시간

---

## 💬 질문 & 답변

### Q1: Functions 탭이 정말 없나요?
**A**: 네, Vercel의 최근 UI에서는 "Functions" 탭이 없고 "Runtime Logs"와 "Observability"로 대체되었습니다.

### Q2: GitHub Actions 로그만으로는 부족한가요?
**A**: 네, GitHub Actions는 "HTTP 200 응답"만 확인하므로, Vercel 내부에서 실제로 무슨 일이 일어났는지는 Runtime Logs에서만 확인 가능합니다.

### Q3: Runtime Logs에서 뭘 찾아야 하나요?
**A**: **Duration 값** (10초 초과 여부)과 **에러 메시지**만 확인하면 됩니다.

---

**작성자**: Claude Sonnet 4.5
**작성일**: 2026-01-14 (업데이트)
