# 엑셀 업로드 모드 선택 기능 구현 예시

## UI 컴포넌트 예시 (React)

```tsx
// 업로드 모달에 추가할 라디오 버튼
const [uploadMode, setUploadMode] = useState<'overwrite' | 'merge' | 'skip'>('overwrite');

<div className="mb-6 p-4 bg-gray-50 rounded-lg">
  <h4 className="font-semibold text-gray-800 mb-3">중복 사업장 처리 방식</h4>

  <div className="space-y-3">
    <label className="flex items-start cursor-pointer">
      <input
        type="radio"
        name="uploadMode"
        value="overwrite"
        checked={uploadMode === 'overwrite'}
        onChange={(e) => setUploadMode(e.target.value as any)}
        className="mt-1 mr-3"
      />
      <div>
        <div className="font-medium text-gray-900">덮어쓰기 (권장)</div>
        <div className="text-sm text-gray-600">
          엑셀의 모든 값으로 기존 데이터를 완전히 교체합니다.
          <br />
          💡 전체 데이터 동기화에 적합
        </div>
      </div>
    </label>

    <label className="flex items-start cursor-pointer">
      <input
        type="radio"
        name="uploadMode"
        value="merge"
        checked={uploadMode === 'merge'}
        onChange={(e) => setUploadMode(e.target.value as any)}
        className="mt-1 mr-3"
      />
      <div>
        <div className="font-medium text-gray-900">병합 (스마트 업데이트)</div>
        <div className="text-sm text-gray-600">
          엑셀에 값이 있는 필드만 업데이트하고, 빈 칸은 기존 값을 유지합니다.
          <br />
          💡 일부 필드만 수정할 때 적합
        </div>
      </div>
    </label>

    <label className="flex items-start cursor-pointer">
      <input
        type="radio"
        name="uploadMode"
        value="skip"
        checked={uploadMode === 'skip'}
        onChange={(e) => setUploadMode(e.target.value as any)}
        className="mt-1 mr-3"
      />
      <div>
        <div className="font-medium text-gray-900">건너뛰기</div>
        <div className="text-sm text-gray-600">
          중복된 사업장은 무시하고, 새로운 사업장만 추가합니다.
          <br />
          💡 신규 데이터만 추가할 때 적합
        </div>
      </div>
    </label>
  </div>
</div>
```

## API 수정 예시

```typescript
// POST 요청 시 모드 전달
const response = await fetch('/api/business-info-direct', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    isBatchUpload: true,
    uploadMode: uploadMode,  // 'overwrite' | 'merge' | 'skip'
    businesses: parsedData
  })
});
```

## 백엔드 로직 예시

```typescript
// route.ts 수정
const uploadMode = businessData.uploadMode || 'overwrite';

for (const business of businessData.businesses) {
  // 기존 사업장 검색
  const { data: existing } = await supabaseAdmin
    .from('business_info')
    .select('*')  // merge 모드를 위해 전체 데이터 가져오기
    .eq('business_name', normalizedName)
    .eq('is_deleted', false)
    .maybeSingle();

  if (existing) {
    // 중복 발견
    switch (uploadMode) {
      case 'overwrite':
        // 덮어쓰기: 모든 필드 업데이트
        await supabaseAdmin
          .from('business_info')
          .update(normalizedData)
          .eq('id', existing.id);
        updated++;
        break;

      case 'merge':
        // 병합: 빈 값이 아닌 필드만 업데이트
        const mergeData: any = { updated_at: new Date().toISOString() };

        Object.keys(normalizedData).forEach(key => {
          const value = normalizedData[key];
          // 값이 있으면 업데이트, 없으면 기존 값 유지
          if (value !== null && value !== undefined && value !== '') {
            mergeData[key] = value;
          }
        });

        await supabaseAdmin
          .from('business_info')
          .update(mergeData)
          .eq('id', existing.id);
        updated++;
        break;

      case 'skip':
        // 건너뛰기: 아무것도 안 함
        skipped++;
        break;
    }
  } else {
    // 새 사업장 추가 (모든 모드에서 동일)
    await supabaseAdmin
      .from('business_info')
      .insert([normalizedData]);
    created++;
  }
}

// 결과 반환
return NextResponse.json({
  success: true,
  data: {
    results: {
      total: businessData.businesses.length,
      created,
      updated,
      skipped,  // 건너뛴 수 추가
      errors
    }
  }
});
```

## 사용자 경험 흐름

```
1. 엑셀 파일 선택
   └─> "사업장정보_2025.xlsx (100개 행)"

2. 업로드 모드 선택 (한 번만)
   └─> ◉ 덮어쓰기
       ○ 병합
       ○ 건너뛰기

3. "업로드 시작" 클릭
   └─> 진행률 표시: 10% → 50% → 100%

4. 결과 확인
   ┌─────────────────────────────┐
   │ ✅ 업로드 완료!              │
   ├─────────────────────────────┤
   │ 총 처리: 100개               │
   │ 신규 추가: 30개              │
   │ 업데이트: 65개               │
   │ 건너뛰기: 5개                │
   │ 오류: 0개                    │
   └─────────────────────────────┘
```

## 주의사항

1. **기본값은 '덮어쓰기'**: 현재 동작 유지
2. **한 번 선택으로 전체 적용**: 각 행마다 묻지 않음
3. **결과 로그 상세화**: 어떤 모드로 처리되었는지 명확히 표시
