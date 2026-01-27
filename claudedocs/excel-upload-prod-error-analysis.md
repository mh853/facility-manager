# Excel Upload Production Error Analysis

## 📋 문제 상황
- **증상**: admin/business 페이지의 엑셀 업로드 기능이 개발 환경에서는 정상 작동하지만 배포(Production) 환경에서 오류 발생
- **영향 범위**: 배치 업로드 기능 (엑셀 파일을 통한 대량 사업장 데이터 등록/수정)

## 🔍 코드 분석 결과

### 1. 엑셀 업로드 흐름
```
[Client] page.tsx:2676 handleFileUpload()
  ↓
1. 동적 import: const XLSX = await import('xlsx')
2. 파일 읽기: file.arrayBuffer()
3. XLSX 파싱: XLSX.read(data)
4. JSON 변환: XLSX.utils.sheet_to_json()
5. 데이터 매핑 및 정규화
  ↓
[API] /api/business-info-direct (POST)
  ↓
6. 배치 업로드 처리 (isBatchUpload: true)
7. 사업장별 INSERT/UPDATE 실행
```

### 2. 환경 차이 분석

| 항목 | 개발 환경 | 배포 환경 (Vercel) |
|------|-----------|-------------------|
| Node.js Runtime | 로컬 설치 버전 | Vercel Serverless Functions |
| 함수 실행 시간 | 제한 없음 | **10초 (Hobby), 60초 (Pro)** |
| 메모리 제한 | 로컬 RAM | **1024MB (Hobby), 3008MB (Pro)** |
| 파일 시스템 | 읽기/쓰기 가능 | **읽기 전용 (임시 /tmp만 쓰기 가능)** |
| 의존성 크기 | 제한 없음 | **50MB 압축 제한** |
| Cold Start | 없음 | **있음 (첫 요청 시 지연)** |

### 3. 가능한 원인 분석

#### 🔴 원인 1: 함수 실행 시간 초과 (가장 가능성 높음)
**증상**:
- 많은 행(>100개)의 엑셀 파일 업로드 시 타임아웃
- Vercel 함수 기본 제한: 10초 (Hobby), 설정된 경우 60초

**확인 방법**:
```javascript
// API 로그에서 다음과 같은 메시지 확인
// "Function execution timed out"
// "ETIMEDOUT"
```

**코드 분석**:
```typescript
// page.tsx:2940 - API 호출
const response = await fetch('/api/business-info-direct', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    isBatchUpload: true,
    uploadMode: uploadMode,
    businesses: mappedBusinesses  // 모든 데이터를 한 번에 전송
  })
})

// route.ts:547-726 - 순차 처리
for (const business of businessData.businesses) {
  // 각 사업장마다 검색 + INSERT/UPDATE 실행
  // N개 사업장 × (검색 쿼리 + 저장 쿼리) = 2N개 쿼리
}
```

**문제점**:
- 100개 사업장 업로드 시: 최소 200개의 DB 쿼리 실행 (검색 + 저장)
- 각 쿼리당 50-200ms 소요 시 10-40초 필요
- Vercel Hobby 플랜 기본 제한 10초 초과

---

#### 🟡 원인 2: 메모리 부족
**증상**:
- 큰 엑셀 파일(수백 행) 업로드 시 오류
- "JavaScript heap out of memory"

**코드 분석**:
```typescript
// page.tsx:2686-2924
const data = await file.arrayBuffer()  // 전체 파일 메모리 로드
const workbook = XLSX.read(data, { type: 'array' })
const jsonData = XLSX.utils.sheet_to_json(worksheet)  // 모든 행 메모리 로드

const mappedBusinesses = jsonData.map((row: any) => {
  // 모든 행을 메모리에 매핑된 객체로 변환
  return { /* 40+ fields */ }
})
```

**문제점**:
- 500행 × 40필드 × 평균 100바이트 = 2MB (원시 데이터)
- 객체 오버헤드 포함 시 실제 메모리 사용량: 10-20MB
- Vercel Hobby 1024MB 제한에서 여유는 있으나, 동시 요청 시 문제 가능

---

#### 🟢 원인 3: xlsx 라이브러리 동적 import 실패
**증상**:
- "Cannot find module 'xlsx'"
- Cold start 시에만 발생

**코드 분석**:
```typescript
// page.tsx:2682
const XLSX = await import('xlsx')  // 동적 import
```

**문제점**:
- `next.config.js:51` - `output: 'standalone'` 설정
- Standalone 빌드 시 일부 동적 import가 번들에서 제외될 수 있음
- 하지만 `package.json`에 `xlsx: ^0.18.5` 정의되어 있어 가능성 낮음

---

#### 🟢 원인 4: API Route의 maxBodySize 제한
**증상**:
- 큰 엑셀 파일 업로드 시 "413 Payload Too Large"

**Vercel 기본값**:
- API Routes: **4.5MB** (압축 전)
- Edge Functions: **4MB** (압축 전)

**코드 분석**:
```typescript
// route.ts:534 - Request body 처리
const businessData = await request.json();
```

**예상 크기 계산**:
```
100개 사업장 × 1KB/사업장 = 100KB (문제 없음)
500개 사업장 × 1KB/사업장 = 500KB (문제 없음)
1000개 사업장 × 1KB/사업장 = 1MB (문제 없음)
```

---

#### 🟠 원인 5: 데이터베이스 연결 풀 고갈
**증상**:
- "Too many connections"
- "Connection pool exhausted"

**코드 분석**:
```typescript
// route.ts:560-563 - 각 사업장마다 DB 조회
existing = await queryOne(
  'SELECT * FROM business_info WHERE business_name = $1 AND is_deleted = false',
  [normalizedName]
);

// route.ts:673-676 - 각 사업장마다 DB 업데이트
await pgQuery(
  `UPDATE business_info SET ${setClause} WHERE id = $${values.length}`,
  values
);
```

**문제점**:
- Serverless 환경에서 DB 연결 풀 관리 어려움
- 동시 다중 요청 시 연결 고갈 가능

---

## 🎯 추천 해결 방안 (우선순위)

### ✅ 해결책 1: vercel.json에 maxDuration 추가 (즉시 적용 가능)

```json
// vercel.json
{
  "functions": {
    "app/api/subsidy-crawler/direct/route.ts": {
      "maxDuration": 60
    },
    "app/api/construction-reports/pdf/route.ts": {
      "maxDuration": 30
    },
    "app/api/business-info-direct/route.ts": {
      "maxDuration": 60
    }
  }
}
```

**효과**:
- 배치 업로드 API 실행 시간을 60초로 확장
- Vercel Pro 플랜 필요

---

### ✅ 해결책 2: 클라이언트 측 배치 분할 (코드 수정 필요)

```typescript
// page.tsx - handleFileUpload() 수정
const BATCH_SIZE = 50; // 50개씩 분할

for (let i = 0; i < mappedBusinesses.length; i += BATCH_SIZE) {
  const batch = mappedBusinesses.slice(i, i + BATCH_SIZE);

  const response = await fetch('/api/business-info-direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      isBatchUpload: true,
      uploadMode: uploadMode,
      businesses: batch
    })
  });

  // 진행률 업데이트
  setUploadProgress(30 + (i / mappedBusinesses.length) * 60);
}
```

**효과**:
- 각 API 호출을 10초 이내로 제한
- Vercel Hobby 플랜에서도 작동
- 사용자에게 진행 상황 피드백

---

### ✅ 해결책 3: 서버 측 배치 처리 최적화 (성능 개선)

```typescript
// route.ts - 배치 INSERT 사용
// 개별 INSERT 대신 단일 배치 INSERT 사용

// 현재 (느림)
for (const business of businessData.businesses) {
  await pgQuery(`INSERT INTO business_info ...`, [...]);
}

// 개선 (빠름)
const values = [];
const placeholders = [];
businessData.businesses.forEach((business, index) => {
  // 모든 값을 배열에 수집
  values.push(...Object.values(business));
  placeholders.push(`($${index * fieldCount + 1}, $${index * fieldCount + 2}, ...)`);
});

await pgQuery(
  `INSERT INTO business_info (field1, field2, ...) VALUES ${placeholders.join(', ')}`,
  values
);
```

**효과**:
- 200개 쿼리 → 1개 쿼리로 단축
- 실행 시간 90% 감소 (40초 → 4초)

---

### ✅ 해결책 4: 에러 로깅 강화 (진단 개선)

```typescript
// route.ts:533 - POST 메서드 시작 부분
export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const businessData = await request.json();
    console.log(`[BATCH-UPLOAD] 시작 - ${businessData.businesses?.length || 0}개 사업장`);

    // ... 기존 코드 ...

  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error(`[BATCH-UPLOAD] 실패 - ${elapsedTime}ms 경과:`, error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      elapsedTime,
      environment: process.env.VERCEL_ENV || 'development'
    }, { status: 500 });
  }
}
```

**효과**:
- Vercel 로그에서 정확한 오류 원인 파악 가능
- 실행 시간 추적으로 타임아웃 여부 확인

---

## 🧪 테스트 계획

### 1단계: 진단 테스트
```
1. Vercel 대시보드 → Functions → business-info-direct 로그 확인
2. 오류 메시지 확인:
   - "Function execution timed out" → 원인 1
   - "Payload Too Large" → 원인 4
   - "Cannot find module" → 원인 3
   - "Connection pool exhausted" → 원인 5
```

### 2단계: 소규모 테스트
```
1. 10개 행의 소규모 엑셀 파일 생성
2. 배포 환경에서 업로드 테스트
3. 성공하면 원인 1 (타임아웃) 확정
```

### 3단계: 점진적 증가 테스트
```
1. 10개 → 성공
2. 50개 → 성공/실패
3. 100개 → 실패
4. 실패 시작 지점에서 타임아웃 발생 추정
```

---

## 📊 권장 구현 우선순위

| 우선순위 | 해결책 | 난이도 | 효과 | 비용 |
|---------|-------|-------|------|-----|
| 1 | maxDuration 60초 설정 | 낮음 | 중간 | Vercel Pro 필요 |
| 2 | 클라이언트 배치 분할 | 중간 | 높음 | 무료 |
| 3 | 에러 로깅 강화 | 낮음 | 진단 | 무료 |
| 4 | 서버 배치 최적화 | 높음 | 매우 높음 | 무료 |

---

## 🚀 즉시 실행 가능한 조치

### Step 1: vercel.json 수정
```bash
# vercel.json에 추가
{
  "functions": {
    "app/api/business-info-direct/route.ts": {
      "maxDuration": 60
    }
  }
}
```

### Step 2: Git commit & deploy
```bash
git add vercel.json
git commit -m "fix: Add maxDuration for business-info-direct API (엑셀 업로드 타임아웃 해결)"
git push
```

### Step 3: Vercel 재배포 확인
- Vercel 대시보드에서 배포 완료 대기
- 배포 완료 후 엑셀 업로드 재테스트

---

## 📝 추가 조사 필요 사항

1. **정확한 오류 메시지 확인**:
   - Vercel 대시보드 → Deployments → Latest → Functions 탭
   - business-info-direct 함수 로그 확인

2. **실제 업로드 파일 크기**:
   - 테스트 중인 엑셀 파일의 행 개수
   - 파일 크기 (KB/MB)

3. **Vercel 플랜 확인**:
   - Hobby (무료) vs Pro ($20/월)
   - 현재 maxDuration 제한 확인

---

## 💡 장기 개선 권장사항

1. **백그라운드 작업 대기열 도입**:
   - Vercel Functions → 백그라운드 작업 (예: BullMQ + Redis)
   - 대용량 업로드를 비동기로 처리

2. **프로그레스 트래킹 개선**:
   - Server-Sent Events (SSE) 사용
   - 실시간 진행률 표시

3. **캐싱 전략**:
   - 업로드된 파일을 임시 저장소에 저장
   - 백그라운드에서 처리 후 완료 알림

---

**문서 버전**: 1.0
**작성일**: 2025-01-27
**상태**: 분석 완료 → 해결책 제시 → 사용자 확인 대기
