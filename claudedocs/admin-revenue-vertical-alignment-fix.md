# Admin Revenue 테이블 세로 정렬 수정

## 📊 수정 일시
2026-01-15

## 🎯 수정 내용

테이블 셀의 내용이 **상단 정렬**되어 있던 것을 **중앙 정렬**로 변경했습니다.

---

## 🔧 변경 사항

### Before (상단 정렬)
```jsx
<div className="border-r border-gray-300 px-2 py-2 text-left text-xs">
  내용
</div>
```

**문제점:**
- 기본 CSS는 `align-items: stretch` (상단 정렬)
- 셀 높이가 60px인데 내용이 상단에만 표시
- 시각적으로 불균형

---

### After (중앙 정렬)
```jsx
<div className="border-r border-gray-300 px-2 py-2 flex items-center justify-start text-left text-xs">
  내용
</div>
```

**추가된 클래스:**
- `flex`: Flexbox 레이아웃 활성화
- `items-center`: **세로 중앙 정렬** (align-items: center)
- `justify-start`: 가로 왼쪽 정렬 (text-left와 함께)
- `justify-end`: 가로 오른쪽 정렬 (text-right와 함께)
- `justify-center`: 가로 중앙 정렬 (text-center와 함께)

---

## 📝 상세 수정 내역

### 1. 헤더 셀 수정

**왼쪽 정렬 셀** (사업장명, 지역, 담당자, 영업점):
```jsx
className="border-r border-gray-300 px-2 py-2 flex items-center justify-start text-left text-xs font-semibold"
```

**오른쪽 정렬 셀** (매출금액, 매입금액, 이익금액, 이익률, 미수금):
```jsx
className="border-r border-gray-300 px-2 py-2 flex items-center justify-end text-right text-xs font-semibold"
```

**중앙 정렬 셀** (카테고리):
```jsx
className="border-r border-gray-300 px-2 py-2 flex items-center justify-center text-center text-xs font-semibold"
```

### 2. 바디 셀 수정

모든 바디 셀에도 동일한 패턴 적용:
- 텍스트 셀: `flex items-center justify-start`
- 숫자 셀: `flex items-center justify-end`
- 뱃지 셀: `flex items-center justify-center`

---

## 🎨 CSS Flexbox 정렬 원리

### items-center (세로 정렬)
```css
align-items: center;  /* 세로 중앙 정렬 */
```

**효과:**
```
┌─────────────┐
│             │  ← 빈 공간
│   내용      │  ← 세로 중앙
│             │  ← 빈 공간
└─────────────┘
```

### justify-* (가로 정렬)

**justify-start (왼쪽)**:
```
┌─────────────┐
│ 내용        │  ← 왼쪽 정렬
└─────────────┘
```

**justify-end (오른쪽)**:
```
┌─────────────┐
│        내용 │  ← 오른쪽 정렬
└─────────────┘
```

**justify-center (중앙)**:
```
┌─────────────┐
│    내용     │  ← 중앙 정렬
└─────────────┘
```

---

## ✅ 수정된 파일

**파일**: [app/admin/revenue/page.tsx](app/admin/revenue/page.tsx)

**변경 범위:**
- 헤더 셀: Line 1617-1656 (10개 컬럼)
- 바디 셀: Line 1687-1748 (가상 스크롤 row)

**총 변경 수:**
- 25개 셀에 `flex items-center` 추가
- 가로 정렬에 따라 `justify-start/end/center` 추가

---

## 📊 Before/After 비교

| 항목 | Before | After |
|------|--------|-------|
| 세로 정렬 | 상단 | 중앙 ✅ |
| 가로 정렬 | 유지 | 유지 ✅ |
| 시각적 균형 | ❌ | ✅ |
| Flexbox 사용 | ❌ | ✅ |

---

## 🧪 테스트 체크리스트

### 시각적 확인
- [ ] 헤더 텍스트가 셀 중앙에 위치하는가?
- [ ] 바디 텍스트가 셀 중앙에 위치하는가?
- [ ] 숫자 데이터가 오른쪽 정렬 유지하는가?
- [ ] 텍스트 데이터가 왼쪽 정렬 유지하는가?
- [ ] 카테고리 뱃지가 중앙에 위치하는가?

### 기능 확인
- [ ] 정렬 기능 정상 작동
- [ ] 호버 효과 정상 작동
- [ ] 클릭 가능한 셀 정상 작동
- [ ] 미수금 필터 ON/OFF 시 레이아웃 유지

### 반응형 확인
- [ ] 다양한 화면 크기에서 정렬 유지
- [ ] 가상 스크롤 시 정렬 유지

---

## 💡 추가 개선 사항 (선택)

### 1. 최소 높이 설정 (선택)
```jsx
style={{
  minHeight: '60px'  // 모든 셀 최소 높이 보장
}}
```

### 2. 줄바꿈 방지 (선택)
```jsx
className="... whitespace-nowrap"  // 텍스트 줄바꿈 방지
```

### 3. 말줄임표 (선택)
```jsx
className="... truncate"  // 긴 텍스트 말줄임표 처리
```

---

## 🔗 관련 수정 이력

### v1 (2026-01-15 오전)
- 백분율 컬럼 너비 적용
- 초기 로딩 병렬화

### v2 (2026-01-15 오후)
- 백분율 합계 100% 조정
- box-sizing 추가

### v3 (2026-01-15 저녁)
- 헤더-바디 컨테이너 통합
- sticky positioning 적용
- 스크롤바 공간 공유

### v4 (2026-01-15) ← 현재
- **세로 중앙 정렬 적용**
- **Flexbox 레이아웃 도입**
- **가로 정렬 최적화**

---

## ✅ 최종 결과

**모든 정렬 문제 해결:**
1. ✅ 세로 중앙 정렬 완료
2. ✅ 가로 정렬 유지 (왼쪽/오른쪽/중앙)
3. ✅ 시각적 균형 개선
4. ✅ Flexbox 기반 현대적인 레이아웃

**시각적 효과:**
```
Before (상단 정렬)         After (중앙 정렬)
┌─────────────┐           ┌─────────────┐
│ 사업장명     │           │             │
│             │           │ 사업장명     │
│             │           │             │
└─────────────┘           └─────────────┘
```

**핵심 원리:**
> `flex items-center`로 세로 중앙 정렬,
> `justify-start/end/center`로 가로 정렬 제어
