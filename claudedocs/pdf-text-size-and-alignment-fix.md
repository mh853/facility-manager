# PDF Text Size Increase & Vertical Alignment Fix (Final)

## 변경 일시
2025-11-04 (최종 수정 - 패딩 조정)

## 변경 사항

### 1. 텍스트 크기 증가

**문제:**
- PDF 본문 폰트 크기가 11px로 너무 작아서 가독성이 떨어짐

**해결:**
- 본문 폰트 크기를 11px → 12px로 증가 (약 9% 증가)

**변경 위치:** `lib/document-generators/pdf-generator-ecosense.ts` line 26

```typescript
// Before
font-size: 11px;

// After
font-size: 12px;
```

### 2. 모든 테이블 셀 수직 정렬 수정 (강화)

**문제:**
- 모든 테이블 셀의 텍스트가 상하 중간 정렬이 안 됨
- HTML-to-Canvas 렌더링에서 `vertical-align: middle;`만으로는 부족
- 명시적인 셀 높이와 패딩이 필요함

**해결:**
- 모든 테이블 셀에 다음 스타일 추가:
  - `height: 35px` - 명시적인 셀 높이 지정
  - `padding: 7px` - 균일한 패딩 (상하좌우 모두 7px)
  - `vertical-align: middle` - 수직 중앙 정렬

**중요:** 초기에 `padding: 10px 7px`로 설정했으나, 상부 패딩이 과도하여 텍스트가 아래로 밀리는 문제 발견. 최종적으로 `padding: 7px`로 조정하여 완벽한 중앙 정렬 달성.

**변경 위치:**
- 담당자 정보: lines 160-166
- 품목 정보: lines 177-184
- 설치 정보: lines 195-196
- 사업장 정보: lines 206-223
- 장비 설정: lines 233-242
- 전류계 타입: lines 253-270
- 발주 금액: lines 281-298

#### 변경 예시 (품목 정보 테이블)

**테이블 헤더:**
```typescript
// Before
<th style="border: 1px solid #2563eb; padding: 7px; text-align: center;">구분</th>

// After (최종)
<th style="border: 1px solid #2563eb; padding: 7px; text-align: center; vertical-align: middle; height: 35px;">구분</th>
```

**테이블 데이터:**
```typescript
// Before
<td style="border: 1px solid #ddd; padding: 7px; text-align: center;">수량</td>

// After (최종)
<td style="border: 1px solid #ddd; padding: 7px; text-align: center; vertical-align: middle; height: 35px;">수량</td>
```

**주의:** 중간에 `padding: 10px 7px`를 시도했으나 상부 패딩 과다로 문제 발생, 최종적으로 `padding: 7px`로 조정

## 변경 전후 비교

### 폰트 크기
| 항목 | 변경 전 | 변경 후 | 변화율 |
|-----|--------|--------|--------|
| 본문 텍스트 | 11px | 12px | +9% |
| 섹션 헤더 | 14px | 14px | 유지 |
| 제목(h1) | 20px | 20px | 유지 |
| 하단 정보 | 10px | 10px | 유지 |
| 결제조건 노트 | 10px | 10px | 유지 |

### 테이블 셀 스타일
| 속성 | 변경 전 | 중간 (문제 발생) | 최종 | 변화 |
|-----|--------|-----------------|------|------|
| 패딩 | 7px | 10px 7px (상하/좌우) | 7px | 유지 (균일) |
| 셀 높이 | 자동 | 35px | 35px | 명시적 지정 |
| 수직 정렬 | 일부만 적용 | 모든 셀 적용 | 모든 셀 적용 | 완전 적용 |

**문제 해결 과정:**
1. 처음에 `padding: 10px 7px`로 상하 패딩을 증가
2. 상부 패딩이 과도하여 텍스트가 셀 하단으로 밀림
3. `padding: 7px`로 재조정하여 완벽한 중앙 정렬 달성

### 수직 정렬 상태
| 섹션 | 변경 전 | 변경 후 |
|-----|--------|--------|
| 담당자 정보 | ⚠️ 정렬 안됨 | ✅ 강화된 중간 정렬 |
| 품목 정보 | ⚠️ 정렬 안됨 | ✅ 강화된 중간 정렬 |
| 설치 정보 | ⚠️ 정렬 안됨 | ✅ 강화된 중간 정렬 |
| 사업장 정보 | ⚠️ 정렬 안됨 | ✅ 강화된 중간 정렬 |
| 장비 설정 | ⚠️ 정렬 안됨 | ✅ 강화된 중간 정렬 |
| 전류계 타입 | ⚠️ 정렬 안됨 | ✅ 강화된 중간 정렬 |
| 발주 금액 | ⚠️ 정렬 안됨 | ✅ 강화된 중간 정렬 |

## 예상 효과

### 긍정적 효과
1. **가독성 개선**: 12px 본문 폰트로 텍스트가 더 읽기 편함
2. **완벽한 수직 정렬**: 명시적인 높이와 패딩으로 HTML-to-Canvas 렌더링에서도 확실한 중앙 정렬
3. **시각적 균형**: 모든 테이블 셀의 텍스트가 상하 중간에 정렬되어 균형감 있음
4. **전문성**: 일관된 정렬로 문서가 더 전문적으로 보임
5. **인쇄 품질**: 적절한 폰트 크기와 셀 높이로 인쇄물에서도 명확하게 보임

### 주의사항
- 셀 높이 증가 (자동 → 35px)로 테이블이 약간 더 많은 공간 차지
- 폰트 크기 증가와 패딩 증가로 전체 콘텐츠 높이 약간 증가
- 대부분의 경우 여전히 1페이지 내에 수용 가능
- 항목이 매우 많은 경우(8개 이상) 페이지 넘김 가능성 약간 증가

## 최종 타이포그래피 설정

```typescript
// PDF 전체 설정
font-size: 12px         // 본문 (11px → 12px)
line-height: 1.35       // 행간 (유지)
font-family: "Noto Sans KR", "Malgun Gothic", ...

// 제목 및 헤더
h1: 20px               // 발주서 제목 (유지)
h2: 14px               // 섹션 헤더 (유지)
business-name: 12px    // 사업장명 부제목 (11px → 12px, 본문과 동일)

// 테이블
table padding: 7px     // 셀 패딩 (유지)
vertical-align: middle // 모든 셀 중간 정렬 (완료)

// 하단 정보
footer: 10px           // 하단 정보 (유지)
note: 10px            // 결제조건 노트 (유지)
```

## 테스트 권장사항

1. **다양한 데이터로 테스트**
   - 최소 항목(2-3개): 폰트 크기 증가 효과 확인
   - 중간 항목(4-6개): 가독성 개선 확인
   - 최대 항목(7-8개): 1페이지 내 수용 여부 확인

2. **수직 정렬 확인**
   - 품목 정보 테이블의 모든 셀이 중간 정렬되는지 확인
   - 다른 섹션들과 시각적 일관성 확인

3. **인쇄 테스트**
   - A4 용지에 실제 인쇄하여 폰트 크기 적절성 확인
   - 모든 텍스트가 명확하게 읽히는지 확인

4. **전체 레이아웃 확인**
   - 폰트 크기 증가로 인한 레이아웃 변화 확인
   - 페이지 넘김 발생 여부 확인

## 관련 문서
- `claudedocs/pdf-final-adjustments.md` - 이전 여백 조정
- `claudedocs/pdf-layout-optimization.md` - 최초 레이아웃 최적화
- `lib/document-generators/pdf-generator-ecosense.ts` - PDF 생성기

## 변경 이력
- 2025-11-04: 본문 폰트 크기 11px → 12px, 품목 정보 테이블 수직 정렬 추가
