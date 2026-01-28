# 보조금 모달 디자인 통일 설계

## 📋 요구사항
수동 등록 모달(`ManualUploadModal`)의 디자인과 텍스트 크기를 상세 모달(`AnnouncementDetailModal`)과 동일하게 변경

## 🔍 현재 상태 분석

### AnnouncementDetailModal (상세 모달) - 기준 디자인
```typescript
// 배경 오버레이
className="fixed inset-0 bg-black/60 backdrop-blur-sm ... animate-fadeIn"

// 모달 컨테이너
className="bg-white rounded-2xl shadow-2xl max-w-3xl ... animate-slideUp"

// 헤더
className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white"

// 닫기 버튼
className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full"
<X className="w-5 h-5" />

// 제목
className="text-base md:text-lg font-bold leading-tight mb-2"

// 상태 배지
className="px-3 py-1.5 rounded-full text-sm font-semibold border-2"
```

### ManualUploadModal (수동 등록 모달) - 현재 디자인
```typescript
// 배경 오버레이
className="fixed inset-0 bg-black bg-opacity-50 ... z-50 p-4"

// 모달 컨테이너
className="bg-white rounded-lg shadow-xl max-w-2xl ... overflow-y-auto"

// 헤더
className="p-6"  // 평범한 흰색 배경

// 닫기 버튼
className="text-gray-400 hover:text-gray-600 text-2xl"
× (텍스트)

// 제목
className="text-2xl font-bold text-gray-900"

// 폼 레이블
className="block text-sm font-medium text-gray-700 mb-2"
```

## 🎨 디자인 차이점

| 요소 | 상세 모달 (기준) | 수동 등록 모달 (현재) | 변경 필요 |
|------|------------------|----------------------|----------|
| **오버레이** | `bg-black/60` + `backdrop-blur-sm` + `animate-fadeIn` | `bg-black bg-opacity-50` | ✅ |
| **컨테이너** | `rounded-2xl` + `shadow-2xl` + `animate-slideUp` | `rounded-lg` + `shadow-xl` | ✅ |
| **최대 너비** | `max-w-3xl` | `max-w-2xl` | ✅ |
| **헤더 배경** | Gradient (`from-blue-600 to-indigo-600`) + `p-6` | 흰색 + `p-6` | ✅ |
| **헤더 텍스트** | 흰색 | 검은색 | ✅ |
| **닫기 버튼** | `<X>` 아이콘 + `rounded-full` hover | `×` 텍스트 + 회색 | ✅ |
| **제목 크기** | `text-base md:text-lg` | `text-2xl` | ✅ |
| **에러 박스** | - | `bg-red-50 border border-red-200` | ⚪ 유지 |
| **폼 레이블** | - | `text-sm` | ⚪ 유지 |

## 🔄 변경 계획

### 1️⃣ Import 추가
```typescript
import { X } from 'lucide-react';  // 닫기 버튼 아이콘
```

### 2️⃣ 배경 오버레이 (Line 230)
```typescript
// BEFORE
className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"

// AFTER
className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
```

### 3️⃣ 모달 컨테이너 (Line 231)
```typescript
// BEFORE
className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"

// AFTER
className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden transform transition-all animate-slideUp"
```

**주의**: `overflow-y-auto`를 제거하고 내부 스크롤 영역 생성 필요

### 4️⃣ 헤더 영역 (Line 232-242)
```typescript
// BEFORE
<div className="p-6">
  <div className="flex justify-between items-center mb-6">
    <h2 className="text-2xl font-bold text-gray-900">
      {editMode ? '✏️ 공고 수정' : '✍️ 수동 공고 등록'}
    </h2>
    <button
      onClick={onClose}
      className="text-gray-400 hover:text-gray-600 text-2xl"
      disabled={isSubmitting}
    >
      ×
    </button>
  </div>

// AFTER
<div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
  <button
    onClick={onClose}
    className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
    disabled={isSubmitting}
  >
    <X className="w-5 h-5" />
  </button>

  <h2 className="text-base md:text-lg font-bold leading-tight mb-2">
    {editMode ? '✏️ 공고 수정' : '✍️ 수동 공고 등록'}
  </h2>
</div>

<div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
  {/* 기존 폼 내용 */}
```

### 5️⃣ 폼 영역 스크롤 처리
헤더를 고정하고 폼 영역만 스크롤되도록 구조 변경:

```typescript
// 구조 변경
<div className="bg-white rounded-2xl ...">
  {/* 1. 고정 헤더 */}
  <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
    ...
  </div>

  {/* 2. 스크롤 가능한 폼 영역 */}
  <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
    {error && ...}
    <form onSubmit={handleSubmit}>
      ...
    </form>
  </div>

  {/* 3. 고정 푸터 (버튼 영역) */}
  <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50">
    <div className="flex justify-end gap-3">
      ...
    </div>
  </div>
</div>
```

### 6️⃣ 버튼 영역 분리 (마지막 부분)
현재 form 내부에 있는 버튼들을 별도 푸터 영역으로 이동:

```typescript
// BEFORE (form 내부)
<div className="flex justify-end gap-3">
  <button type="button" ...>취소</button>
  <button type="submit" ...>등록</button>
</div>

// AFTER (form 외부, 고정 푸터)
</form>
</div>

{/* 고정 푸터 */}
<div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50">
  <div className="flex justify-end gap-3">
    <button
      type="button"
      onClick={onClose}
      disabled={isSubmitting}
      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
    >
      취소
    </button>
    <button
      type="submit"
      form="manual-announcement-form"  {/* form 속성으로 연결 */}
      disabled={isSubmitting}
      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
    >
      {isSubmitting ? '처리 중...' : (editMode ? '수정' : '등록')}
    </button>
  </div>
</div>
```

**주의**: `<form>` 태그에 `id="manual-announcement-form"` 추가하고, submit 버튼의 `form` 속성으로 연결

## 🎯 CSS 애니메이션 추가 필요

Tailwind config 또는 globals.css에 애니메이션 추가:

```css
/* globals.css */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}

.animate-slideUp {
  animation: slideUp 0.3s ease-out;
}
```

또는 Tailwind 설정:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        slideUp: {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out',
        slideUp: 'slideUp 0.3s ease-out',
      }
    }
  }
}
```

## 📝 변경 파일 목록

1. **components/subsidy/ManualUploadModal.tsx** (주요 변경)
   - Import 추가: `X` from `lucide-react`
   - 배경 오버레이 스타일 변경
   - 모달 컨테이너 스타일 변경
   - 헤더 영역 Gradient 배경 적용
   - 닫기 버튼 아이콘으로 변경
   - 제목 텍스트 크기 조정
   - 스크롤 영역 재구조화
   - 버튼 영역 푸터로 분리

2. **app/globals.css** 또는 **tailwind.config.js** (선택)
   - 애니메이션 추가 (이미 있다면 스킵)

## ✅ 테스트 체크리스트

- [ ] 모달 배경 블러 효과 확인
- [ ] 모달 열림 애니메이션 확인 (fadeIn, slideUp)
- [ ] 헤더 Gradient 배경 적용 확인
- [ ] 닫기 버튼 아이콘 및 hover 효과 확인
- [ ] 제목 텍스트 크기 반응형 확인 (base → md:lg)
- [ ] 폼 영역 스크롤 동작 확인
- [ ] 버튼 영역 하단 고정 확인
- [ ] 등록/수정 버튼 동작 확인 (form 속성 연결)
- [ ] 모바일 반응형 확인
- [ ] 에러 메시지 표시 확인

## 🎨 최종 비주얼

### Before (현재)
```
┌────────────────────────────┐
│ ✍️ 수동 공고 등록      × │  ← 흰색 배경, text-2xl
├────────────────────────────┤
│                            │
│  [폼 필드들]               │
│                            │
│                            │
│  [취소] [등록]             │
└────────────────────────────┘
```

### After (변경 후)
```
┌────────────────────────────┐
│ 🔵🟣 Gradient Header    ⓧ │  ← Gradient 배경, text-base md:text-lg
│ ✍️ 수동 공고 등록          │
├────────────────────────────┤
│ ↕️ 스크롤 영역             │
│  [폼 필드들]               │
│                            │
├────────────────────────────┤
│  [취소] [등록]             │  ← 고정 푸터
└────────────────────────────┘
```

## 💡 추가 고려사항

1. **일관성 유지**: 상세 모달과 동일한 시각적 언어 사용
2. **사용성**: 헤더 고정으로 항상 제목과 닫기 버튼 접근 가능
3. **반응형**: 모바일에서도 적절한 텍스트 크기 유지
4. **애니메이션**: 부드러운 전환 효과로 사용자 경험 향상
5. **접근성**: 닫기 버튼에 적절한 aria-label 추가 권장

## 🚀 구현 우선순위

1. **높음** (시각적 통일성)
   - 헤더 Gradient 배경
   - 닫기 버튼 아이콘화
   - 모달 컨테이너 rounded-2xl

2. **중간** (UX 개선)
   - 스크롤 영역 재구조화
   - 버튼 영역 푸터 분리
   - 애니메이션 추가

3. **낮음** (세부 조정)
   - 최대 너비 조정 (2xl → 3xl)
   - 텍스트 크기 미세 조정
