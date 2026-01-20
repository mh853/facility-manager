# 크롤링 시작 버튼이 표시되지 않는 문제 해결

## 문제 상황
- 모니터링 대시보드에 "크롤링 시작" 버튼이 보이지 않음
- "새로고침" 버튼만 표시됨

## 원인 분석
1. **브라우저 캐시**: 이전 버전의 페이지가 캐시되어 있음
2. **Hot Reload 실패**: Next.js 개발 서버의 Hot Module Replacement가 제대로 작동하지 않음
3. **빌드 캐시**: Next.js `.next` 디렉토리 캐시 문제

## 해결 방법

### 방법 1: 브라우저 하드 리프레시 (가장 빠름)
```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

### 방법 2: 시크릿/프라이빗 모드
- 새 시크릿 창에서 `http://localhost:3000/admin/subsidy/monitoring` 접속

### 방법 3: 개발 서버 재시작
```bash
# 터미널에서 Ctrl+C로 서버 중지
npm run dev
```

### 방법 4: Next.js 캐시 완전 삭제 (최후의 수단)
```bash
# 서버 중지 후
rm -rf .next
npm run dev
```

## 코드 확인

### 버튼이 있는 위치
`app/admin/subsidy/monitoring/page.tsx` 145-176번 줄:

```tsx
<AdminLayout
  title="📊 크롤링 모니터링"
  actions={
    <>
      <button
        onClick={handleManualCrawl}
        disabled={crawling}
        className={`px-4 py-2 text-white rounded-lg transition-colors ${
          crawling
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {crawling ? (
          <>
            <span className="inline-block animate-spin mr-2">⏳</span>
            크롤링 실행 중...
          </>
        ) : (
          <>▶️ 크롤링 시작</>
        )}
      </button>
      <button
        onClick={loadRuns}
        disabled={crawling}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        🔄 새로고침
      </button>
    </>
  }
>
```

### AdminLayout의 actions 렌더링 위치
`components/ui/AdminLayout.tsx` 419-425번 줄 (데스크톱):

```tsx
{/* Desktop Actions */}
{actions && (
  <div className="flex items-center gap-3">
    {actions}
  </div>
)}
```

## 개발자 도구로 확인하기

1. 브라우저에서 F12 (개발자 도구 열기)
2. Console 탭에서:
   ```javascript
   // AdminLayout의 actions prop 확인
   document.querySelector('.flex.items-center.gap-3')
   ```

3. Elements 탭에서:
   - Header 영역 검사
   - "새로고침" 버튼 찾기
   - 그 앞에 "크롤링 시작" 버튼이 있는지 확인

## 예상 결과

정상적으로 로드되면:
```
[▶️ 크롤링 시작] [🔄 새로고침] [🕐 오후 12:15] [🔔]
```

## Git 커밋 확인

최신 커밋:
```bash
git log --oneline -1
# 0604104 feat: 모니터링 대시보드에 수동 크롤링 실행 기능 추가
```

## 추가 디버깅

만약 위의 방법들로도 해결되지 않으면:

1. **React DevTools로 확인**:
   - React DevTools 설치
   - AdminLayout 컴포넌트 찾기
   - `actions` prop 값 확인

2. **콘솔 에러 확인**:
   - F12 → Console 탭
   - 에러 메시지 확인

3. **네트워크 탭 확인**:
   - F12 → Network 탭
   - `page.tsx` 파일이 제대로 로드되는지 확인
   - 304 (cached) vs 200 (new) 상태 코드 확인
