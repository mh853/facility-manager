# Batch INSERT Optimization Design

## 🎯 목표
3,000개 사업장 업로드 시간을 **3분 → 30초**로 단축 (90% 감소)

## 📊 현재 문제점

### 현재 알고리즘 (순차 처리)
```typescript
for (const business of businesses) {  // N번 반복
  // 1. 검색 쿼리
  existing = await queryOne('SELECT * FROM business_info WHERE business_name = $1', [name]);

  // 2. INSERT 또는 UPDATE 쿼리
  if (existing) {
    await pgQuery('UPDATE business_info SET ... WHERE id = $1', [...]);
  } else {
    await pgQuery('INSERT INTO business_info VALUES (...)', [...]);
  }
}
```

**성능 분석**:
- 3,000개 사업장 × 2개 쿼리 = **6,000개 DB 쿼리**
- 각 쿼리 평균 50ms → 총 **300초 (5분)**
- DB 연결 오버헤드, 네트워크 지연 누적

---

## ✅ 최적화 전략

### 전략 1: 배치 검색 (Bulk Lookup)
개별 검색 대신 **IN 절**로 한 번에 검색:
```sql
-- 기존: N번 실행
SELECT * FROM business_info WHERE business_name = '사업장1';
SELECT * FROM business_info WHERE business_name = '사업장2';
...

-- 최적화: 1번 실행
SELECT * FROM business_info
WHERE business_name IN ('사업장1', '사업장2', ..., '사업장3000')
AND is_deleted = false;
```

**효과**: 3,000개 쿼리 → 1개 쿼리

---

### 전략 2: 배치 INSERT with UPSERT
```sql
INSERT INTO business_info (
  business_name, address, local_government, ...
) VALUES
  ($1, $2, $3, ...),
  ($4, $5, $6, ...),
  ...
  ($8998, $8999, $9000, ...)
ON CONFLICT (business_name)
DO UPDATE SET
  address = EXCLUDED.address,
  local_government = EXCLUDED.local_government,
  ...
  updated_at = EXCLUDED.updated_at;
```

**핵심 장점**:
- 3,000개 INSERT 쿼리 → 1개 쿼리
- ON CONFLICT: 중복 시 자동 UPDATE (별도 검색 불필요)
- PostgreSQL 트랜잭션 최적화

---

### 전략 3: 업로드 모드별 처리

#### 모드 1: overwrite (덮어쓰기)
```sql
INSERT INTO business_info (...) VALUES (...)
ON CONFLICT (business_name)
DO UPDATE SET
  -- 모든 필드 업데이트
  field1 = EXCLUDED.field1,
  field2 = EXCLUDED.field2,
  ...
```

#### 모드 2: merge (병합)
```sql
INSERT INTO business_info (...) VALUES (...)
ON CONFLICT (business_name)
DO UPDATE SET
  -- 빈 값이 아닌 필드만 업데이트
  field1 = COALESCE(NULLIF(EXCLUDED.field1, ''), business_info.field1),
  field2 = COALESCE(NULLIF(EXCLUDED.field2, ''), business_info.field2),
  ...
```

#### 모드 3: skip (건너뛰기)
```sql
INSERT INTO business_info (...) VALUES (...)
ON CONFLICT (business_name) DO NOTHING;
```

---

## 🏗️ 구현 설계

### 1. 데이터 전처리
```typescript
function prepareBatchData(businesses: any[]) {
  const normalizedBusinesses = businesses.map(business => ({
    business_name: normalizeUTF8(business.business_name || ''),
    address: normalizeUTF8(business.address || ''),
    // ... 모든 필드 정규화
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
    is_deleted: false
  }));

  // 사업장명이 비어있는 항목 제거
  return normalizedBusinesses.filter(b => b.business_name);
}
```

---

### 2. 배치 INSERT 쿼리 생성
```typescript
function buildBatchInsertQuery(
  businesses: any[],
  uploadMode: 'overwrite' | 'merge' | 'skip'
) {
  const fields = Object.keys(businesses[0]);
  const fieldCount = fields.length;

  // Placeholders: ($1, $2, ...), ($N+1, $N+2, ...), ...
  const valuePlaceholders = businesses.map((_, index) => {
    const start = index * fieldCount;
    const placeholders = Array.from(
      { length: fieldCount },
      (_, i) => `$${start + i + 1}`
    );
    return `(${placeholders.join(', ')})`;
  }).join(', ');

  // 모든 값을 1차원 배열로 평탄화
  const values = businesses.flatMap(business =>
    fields.map(field => business[field])
  );

  // ON CONFLICT 절 생성
  let conflictClause = '';

  if (uploadMode === 'overwrite') {
    // 모든 필드 덮어쓰기
    const updateFields = fields
      .filter(f => f !== 'business_name' && f !== 'created_at')
      .map(field => `${field} = EXCLUDED.${field}`)
      .join(', ');

    conflictClause = `
      ON CONFLICT (business_name)
      DO UPDATE SET ${updateFields}
    `;
  } else if (uploadMode === 'merge') {
    // 빈 값이 아닌 필드만 업데이트
    const updateFields = fields
      .filter(f => f !== 'business_name' && f !== 'created_at')
      .map(field => {
        // 숫자 필드는 0이 아닌 경우만, 문자열은 빈 값이 아닌 경우만
        if (['ph_meter', 'gateway', 'vpn_wired', /* ... */].includes(field)) {
          return `${field} = CASE
            WHEN EXCLUDED.${field} != 0 THEN EXCLUDED.${field}
            ELSE business_info.${field}
          END`;
        } else {
          return `${field} = COALESCE(
            NULLIF(EXCLUDED.${field}, ''),
            business_info.${field}
          )`;
        }
      })
      .join(', ');

    conflictClause = `
      ON CONFLICT (business_name)
      DO UPDATE SET ${updateFields}
    `;
  } else if (uploadMode === 'skip') {
    // 중복 시 아무것도 안 함
    conflictClause = 'ON CONFLICT (business_name) DO NOTHING';
  }

  const query = `
    INSERT INTO business_info (${fields.join(', ')})
    VALUES ${valuePlaceholders}
    ${conflictClause}
    RETURNING id, business_name,
      (xmax = 0) AS was_inserted
  `;

  return { query, values };
}
```

**RETURNING 절 설명**:
- `xmax = 0`: INSERT된 경우 true, UPDATE된 경우 false
- 이를 통해 created vs updated 개수 구분 가능

---

### 3. 배치 크기 제한
PostgreSQL의 제약사항:
- 최대 파라미터 개수: **65,535개**
- 최대 VALUES 행 개수: 이론상 무제한, 실제로는 메모리 제한

**안전한 배치 크기 계산**:
```typescript
const FIELD_COUNT = 40; // 사업장 테이블 필드 개수
const MAX_PARAMS = 65535;
const MAX_BATCH_SIZE = Math.floor(MAX_PARAMS / FIELD_COUNT); // 1,638개

// 안전 마진 20% 적용
const SAFE_BATCH_SIZE = Math.floor(MAX_BATCH_SIZE * 0.8); // 1,310개
```

**배치 분할 로직**:
```typescript
async function processBatchInsert(
  businesses: any[],
  uploadMode: string
) {
  const BATCH_SIZE = 1000; // 안전한 크기

  for (let i = 0; i < businesses.length; i += BATCH_SIZE) {
    const batch = businesses.slice(i, i + BATCH_SIZE);
    await executeBatchInsert(batch, uploadMode);
  }
}
```

---

### 4. 트랜잭션 처리
```typescript
async function executeBatchInsertWithTransaction(
  businesses: any[],
  uploadMode: string
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { query, values } = buildBatchInsertQuery(businesses, uploadMode);
    const result = await client.query(query, values);

    await client.query('COMMIT');

    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## 📊 성능 예측

### 시나리오: 3,000개 사업장 업로드

#### 현재 (순차 처리)
```
6,000개 쿼리 × 50ms = 300초 (5분)
```

#### 최적화 후 (배치 처리)
```
3개 배치 × 10초 = 30초
```

**개선율**: 90% (5분 → 30초)

---

### 배치 크기별 성능

| 배치 크기 | 배치 개수 | 예상 소요 시간 |
|----------|----------|--------------|
| 100개 | 30개 | 90초 |
| 500개 | 6개 | 45초 |
| **1,000개** | **3개** | **30초** (권장) |
| 1,310개 | 3개 | 25초 |

---

## 🔐 안전성 고려사항

### 1. 부분 실패 처리
```typescript
const results = {
  totalBatches: 0,
  successfulBatches: 0,
  failedBatches: 0,
  created: 0,
  updated: 0,
  errors: []
};

for (let i = 0; i < batches.length; i++) {
  try {
    const batchResult = await executeBatchInsert(batches[i], uploadMode);
    results.successfulBatches++;
    results.created += batchResult.created;
    results.updated += batchResult.updated;
  } catch (error) {
    results.failedBatches++;
    results.errors.push({
      batchIndex: i,
      batchSize: batches[i].length,
      error: error.message
    });
  }
}
```

### 2. 메모리 관리
```typescript
// 큰 배열을 작은 청크로 분할하여 처리
function* batchGenerator(array: any[], batchSize: number) {
  for (let i = 0; i < array.length; i += batchSize) {
    yield array.slice(i, i + batchSize);
  }
}

// 사용
for (const batch of batchGenerator(businesses, 1000)) {
  await processBatch(batch);
}
```

### 3. 타임아웃 방지
```typescript
// Vercel Pro: 300초 제한
// 안전 마진: 280초 (93%)
const TIMEOUT_MARGIN = 280 * 1000; // ms
const startTime = Date.now();

for (const batch of batches) {
  if (Date.now() - startTime > TIMEOUT_MARGIN) {
    throw new Error('처리 시간 초과 임박 - 나머지는 다음 요청으로');
  }
  await processBatch(batch);
}
```

---

## 🎯 구현 체크리스트

- [ ] 배치 INSERT 쿼리 빌더 함수 작성
- [ ] ON CONFLICT 절 모드별 처리
- [ ] 배치 크기 제한 로직 (1,000개)
- [ ] 트랜잭션 처리 추가
- [ ] RETURNING 절로 created/updated 구분
- [ ] 부분 실패 처리 및 에러 로깅
- [ ] 메모리 효율적인 배치 생성
- [ ] 기존 순차 처리 코드 교체
- [ ] 성능 테스트 (10개, 100개, 1000개, 3000개)
- [ ] vercel.json maxDuration 확인

---

## 📝 다음 단계

1. **배치 INSERT 함수 구현**
2. **기존 POST 메서드 리팩토링**
3. **테스트 및 성능 측정**
4. **배포 및 모니터링**

---

**문서 버전**: 1.0
**작성일**: 2025-01-27
**상태**: 설계 완료 → 구현 준비
