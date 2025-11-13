# 브라우저 캐시 문제 해결 가이드

## 문제 상황
- 코드는 수정되었지만 브라우저가 이전 JavaScript를 실행 중
- DELETE /api/facility-photos (❌ 잘못된 엔드포인트)
- DELETE /api/facility-photos/{photoId} (✅ 올바른 엔드포인트)

## 해결 방법

### 1단계: 브라우저 강제 새로고침
**Windows/Linux**: `Ctrl + Shift + R` 또는 `Ctrl + F5`
**Mac**: `Cmd + Shift + R`

### 2단계: 캐시 완전 삭제
1. 브라우저 개발자 도구 열기 (F12)
2. Network 탭 선택
3. "Disable cache" 체크박스 활성화
4. 페이지 새로고침

### 3단계: 시크릿 모드로 테스트
- 새 시크릿 창 열기
- http://localhost:3000/business/(유)태현환경 접속
- 사진 삭제 테스트

## 확인 방법

### 올바른 요청 확인
브라우저 콘솔에서 다음 로그를 확인:
```
🌐 [API-DELETE-START] 서버 삭제 API 호출 시작: DELETE /api/facility-photos/c2e206bb-...
```

### 서버 로그에서 확인
```
🗑️ [PHOTO-DELETE] 사진 삭제 시작: {...}
✅ [PHOTO-DELETE] Storage 삭제 완료
✅ [PHOTO-DELETE] DB 삭제 완료
DELETE /api/facility-photos/c2e206bb-... 200 in ...ms
```

## 여전히 안 되면

개발 서버 재시작:
```bash
# 포트 3000 프로세스 종료
lsof -ti:3000 | xargs kill -9

# 개발 서버 재시작
npm run dev
```

그 후 브라우저 강제 새로고침
