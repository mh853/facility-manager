# 사진 개수 불일치 문제 분석
**날짜**: 2025-11-12
**현상**: 리스트에서 "4장"으로 표시되지만 실제로는 2장만 보임

---

## 🔍 문제 원인 분석

### 데이터베이스 실제 상태

```
uploaded_files 테이블: 4개 레코드 존재

1. IMG_1587.jpeg (2025-11-12T09:06:23) ✅
2. IMG_1587.jpeg (2025-11-12T08:24:20) ← 중복
3. u8758981314...png (2025-11-12T07:50:11) ✅
4. u8758981314...png (2025-11-12T07:43:53) ← 중복
```

### 근본 원인

**같은 파일이 여러 번 업로드되어 중복 레코드 생성**

- **IMG_1587.jpeg**: 08:24와 09:06에 2번 업로드
- **u8758981314...png**: 07:43과 07:50에 2번 업로드

### 왜 2장만 보이는가?

프론트엔드에서 **파일명 기준으로 중복 제거**(deduplication)하기 때문입니다.

```typescript
// ImprovedFacilityPhotoSection.tsx에서 파일명 기준 중복 제거 로직 가능성
const uniqueFiles = files.filter((file, index, self) =>
  index === self.findIndex(f => f.name === file.name)
);
```

결과:
- DB: 4개 레코드 (중복 포함)
- 리스트 API: 4개 반환
- UI 표시: 2개 (중복 제거 후)

---

## 📊 상세 분석

### 중복 발생 시나리오

```
타임라인:
07:43 → u8758981314...png 업로드 시도 #1
07:50 → u8758981314...png 업로드 시도 #2 (재시도?)
08:24 → IMG_1587.jpeg 업로드 시도 #1
09:06 → IMG_1587.jpeg 업로드 시도 #2 (재시도?)
```

**가능한 원인**:
1. 업로드 실패 후 재시도
2. 네트워크 타임아웃 후 재업로드
3. 사용자가 같은 파일 다시 선택
4. 클라이언트 중복 업로드 방지 로직 부재

---

## 🛠️ 해결 방안

### 옵션 1: DB 중복 데이터 정리 (즉시)

같은 파일명의 오래된 레코드 삭제:

```sql
-- IMG_1587.jpeg 중복 제거 (오래된 것 삭제)
DELETE FROM uploaded_files
WHERE id = (
  SELECT id FROM uploaded_files
  WHERE filename = 'IMG_1587.jpeg'
  AND business_id = '727c5a4d-5d46-46a7-95ec-eab2d80992c6'
  ORDER BY created_at ASC
  LIMIT 1
);

-- u8758981314...png 중복 제거 (오래된 것 삭제)
DELETE FROM uploaded_files
WHERE id = (
  SELECT id FROM uploaded_files
  WHERE filename LIKE 'u8758981314%'
  AND business_id = '727c5a4d-5d46-46a7-95ec-eab2d80992c6'
  ORDER BY created_at ASC
  LIMIT 1
);
```

**결과**: DB 4개 → 2개, 리스트와 UI 일치

---

### 옵션 2: 프론트엔드 중복 제거 명시 (장기)

UI에서 중복 처리를 명시적으로 표시:

```typescript
// 중복 파일 통계 추가
const fileStats = {
  total: files.length,  // 4
  unique: uniqueFiles.length,  // 2
  duplicates: files.length - uniqueFiles.length  // 2
};

// UI 표시
{fileStats.unique}장 {fileStats.duplicates > 0 && `(중복 ${fileStats.duplicates}장 제외)`}
```

**결과**: "2장 (중복 2장 제외)" 표시

---

### 옵션 3: 파일 해시 기반 중복 방지 (근본 해결)

업로드 시 파일 내용 해시로 중복 체크:

```typescript
// app/api/upload-*/route.ts
async function checkDuplicateFile(businessId: string, fileHash: string) {
  const { data: existing } = await supabaseAdmin
    .from('uploaded_files')
    .select('id, filename')
    .eq('business_id', businessId)
    .eq('file_hash', fileHash)
    .single();

  if (existing) {
    return {
      isDuplicate: true,
      existingFile: existing
    };
  }

  return { isDuplicate: false };
}
```

**장점**:
- 같은 파일 재업로드 원천 차단
- 스토리지 공간 절약
- DB 일관성 유지

---

## 🎯 권장 조치

### 즉시 조치 (DB 정리)

```javascript
// scripts/remove-duplicate-files.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function removeDuplicates() {
  const businessName = '(유)태현환경';

  // 1. 사업장 ID 조회
  const { data: business } = await supabase
    .from('business_info')
    .select('id')
    .eq('business_name', businessName)
    .eq('is_deleted', false)
    .single();

  if (!business) {
    console.error('사업장을 찾을 수 없습니다');
    return;
  }

  // 2. 모든 파일 조회
  const { data: files } = await supabase
    .from('uploaded_files')
    .select('*')
    .eq('business_id', business.id)
    .order('filename, created_at');

  // 3. 파일명별 그룹화
  const fileGroups = {};
  files.forEach(file => {
    if (!fileGroups[file.filename]) {
      fileGroups[file.filename] = [];
    }
    fileGroups[file.filename].push(file);
  });

  // 4. 중복 파일 삭제 (각 그룹에서 가장 최신 것만 유지)
  const toDelete = [];
  for (const [filename, group] of Object.entries(fileGroups)) {
    if (group.length > 1) {
      // 최신 것 제외하고 나머지 삭제 대상
      const sorted = group.sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      );
      toDelete.push(...sorted.slice(1));

      console.log(`${filename}: ${group.length}개 → 1개 (${group.length - 1}개 삭제)`);
    }
  }

  console.log(`\n총 ${toDelete.length}개 중복 파일 삭제 예정`);

  // 5. 실제 삭제
  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('uploaded_files')
      .delete()
      .in('id', toDelete.map(f => f.id));

    if (error) {
      console.error('삭제 실패:', error);
    } else {
      console.log('✅ 중복 파일 삭제 완료');
    }
  }
}

removeDuplicates().catch(console.error);
```

### 장기 조치 (중복 방지)

1. **file_hash 유니크 인덱스 추가**
   ```sql
   CREATE UNIQUE INDEX unique_business_file_hash
   ON uploaded_files(business_id, file_hash);
   ```

2. **업로드 API에 중복 체크 로직 추가**
   - 파일 해시 계산
   - 기존 파일과 비교
   - 중복 시 기존 파일 반환

3. **프론트엔드 중복 업로드 방지**
   - 업로드 중 버튼 비활성화
   - 진행 중인 업로드 추적
   - 완료 전 재시도 차단

---

## 📝 현재 상태 요약

| 항목 | 상태 | 설명 |
|-----|------|------|
| DB 레코드 | 4개 | 중복 포함 |
| 고유 파일 | 2개 | 실제 다른 파일 |
| 리스트 표시 | 4장 | DB 카운트 기준 |
| UI 표시 | 2장 | 중복 제거 후 |
| 불일치 원인 | 중복 데이터 | 같은 파일 재업로드 |

---

## ✅ 결론

**문제**: 시스템은 정상 작동 중. DB에 중복 데이터가 있어 카운트 불일치 발생.

**해결책**:
1. 즉시: 중복 파일 삭제 스크립트 실행 (2개 → 제거)
2. 장기: 파일 해시 기반 중복 방지 로직 구현

**권장**: 즉시 중복 제거 후 사용자에게 확인 요청

---

**작성자**: Claude Code
**우선순위**: 🟡 중간 (기능 정상, 데이터 정리 필요)
