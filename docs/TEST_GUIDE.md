# 시설관리시스템 테스트 가이드

## 📋 테스트 단계별 가이드

### 1단계: 기본 설정 확인
설정 단계를 완료했는지 확인하세요:
- ✅ Supabase 프로젝트 생성됨
- ✅ `.env.local` 파일에 환경변수 설정됨
- ✅ `database/schema.sql` 실행됨
- ✅ `npm run dev` 서버 실행 중

### 2단계: 자동 테스트 실행

#### 2.1 테스트 페이지 접속
1. 브라우저에서 http://localhost:3000/test 접속
2. "전체 테스트 실행" 버튼 클릭
3. 모든 테스트가 초록색(성공)으로 표시되는지 확인

#### 2.2 개별 테스트 확인
각 테스트 항목별 기대 결과:

**데이터베이스 연결 테스트**
```json
✅ 성공 시:
{
  "success": true,
  "message": "Supabase 연결 성공",
  "data": {
    "tablesFound": 6,
    "expectedTables": 6,
    "tables": ["business_info", "air_permit_info", "discharge_outlets", "discharge_facilities", "prevention_facilities", "data_history"]
  }
}
```

**샘플 데이터 조회**
```json
✅ 성공 시:
{
  "success": true,
  "message": "샘플 데이터 조회 성공",
  "data": {
    "businessCount": 0, // 또는 기존 데이터 개수
    "businesses": [],
    "summary": []
  }
}
```

### 3단계: 테스트 데이터 생성 (선택사항)

#### 3.1 Supabase SQL Editor에서 테스트 데이터 생성
1. Supabase 대시보드 → SQL Editor
2. `database/test-data.sql` 내용 복사하여 실행
3. 실행 결과에서 생성된 데이터 개수 확인:
   - businesses_created: 3
   - permits_created: 3  
   - outlets_created: 4
   - discharge_facilities_created: 6
   - prevention_facilities_created: 6

#### 3.2 테스트 데이터 확인
테스트 페이지에서 "샘플 데이터 조회" 다시 실행하여 데이터 확인

### 4단계: 관리자 기능 테스트

#### 4.1 사업장 관리 테스트
1. http://localhost:3000/admin/business 접속
2. **사업장 목록 확인**: 테스트 데이터가 표시되는지 확인
3. **새 사업장 추가 테스트**:
   - "새 사업장 추가" 버튼 클릭
   - 모든 필드 입력 후 저장
   - 목록에 추가되는지 확인
4. **사업장 편집 테스트**:
   - 기존 사업장의 "편집" 버튼 클릭
   - 정보 수정 후 저장
   - 변경사항 반영 확인
5. **사업장 삭제 테스트**:
   - 테스트용 사업장 삭제
   - 목록에서 제거 확인

#### 4.2 대기필증 관리 테스트
1. http://localhost:3000/admin/air-permit 접속
2. **사업장 선택**: 왼쪽에서 사업장 선택
3. **대기필증 목록 확인**: 해당 사업장의 대기필증 표시 확인
4. **새 대기필증 추가**:
   - "새 대기필증 추가" 버튼 클릭
   - 정보 입력 후 저장
5. **배출구/시설관리 접속**: "배출구/시설관리" 링크 클릭하여 페이지 이동 확인

#### 4.3 데이터 이력 관리 테스트
1. http://localhost:3000/admin/data-history 접속
2. **이력 조회**: 이전에 수행한 작업들의 이력 확인
3. **필터 테스트**:
   - 테이블 선택하여 필터 적용
   - 조회 버튼으로 필터링 결과 확인
4. **상세 정보 확인**: 이력 항목의 "상세" 버튼 클릭
5. **복구 기능 테스트** (주의: 실제 데이터가 변경됨):
   - UPDATE나 DELETE 이력에서 "복구" 버튼 클릭
   - 복구 사유 입력 후 실행

#### 4.4 문서 자동화 테스트 (Google API 설정된 경우)
1. http://localhost:3000/admin/document-automation 접속
2. **템플릿 확인**: 설정된 템플릿이 표시되는지 확인
3. **미리보기 테스트**:
   - 사업장 선택 후 "미리보기" 클릭
   - 플레이스홀더 데이터 확인
4. **단일 문서 생성**: 사업장별 "단일 생성" 버튼 테스트

### 5단계: 오류 상황 테스트

#### 5.1 의도적 오류 발생
1. **잘못된 데이터 입력**:
   - 필수 필드 누락하고 저장 시도
   - 중복된 사업장명으로 생성 시도
2. **네트워크 오류 시뮬레이션**:
   - 개발자 도구에서 네트워크 차단 후 요청

#### 5.2 오류 메시지 확인
- 사용자 친화적인 오류 메시지 표시 확인
- 브라우저 콘솔에 상세 오류 정보 확인

### 6단계: 성능 테스트

#### 6.1 대량 데이터 테스트
```sql
-- Supabase SQL Editor에서 실행
-- 100개 테스트 사업장 생성
INSERT INTO business_info (business_name, local_government, is_active, is_deleted)
SELECT 
    '대량테스트사업장_' || i,
    '테스트시_' || (i % 10),
    true,
    false
FROM generate_series(1, 100) as i;
```

#### 6.2 페이지 로딩 속도 확인
- 사업장 목록 페이지 로딩 시간
- 검색 기능 응답 시간
- 데이터 이력 페이지 로딩 시간

### 🔧 문제 해결

#### 일반적인 문제와 해결방법

**1. "Supabase 연결 실패"**
```
해결방법:
1. .env.local 파일의 Supabase URL과 키 확인
2. Supabase 프로젝트가 활성화되어 있는지 확인
3. 환경변수 이름 철자 확인 (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
```

**2. "테이블을 찾을 수 없음"**
```
해결방법:
1. database/schema.sql이 완전히 실행되었는지 확인
2. Supabase Table Editor에서 테이블 존재 여부 확인
3. SQL 실행 중 오류가 있었는지 확인
```

**3. "권한 없음" 오류**
```
해결방법:
1. RLS (Row Level Security) 정책 확인
2. SUPABASE_SERVICE_ROLE_KEY가 올바른지 확인
3. 필요시 schema.sql의 정책 부분 다시 실행
```

**4. "문서 자동화 실패"**
```
해결방법:
1. Google API 환경변수 설정 확인
2. Google 서비스 계정 권한 확인
3. 템플릿 ID가 올바른지 확인
```

### ✅ 테스트 완료 체크리스트

- [ ] 모든 자동 테스트가 성공
- [ ] 사업장 CRUD 기능 정상 작동
- [ ] 대기필증 관리 기능 정상 작동
- [ ] 데이터 이력 추적 및 복구 기능 확인
- [ ] 오류 처리 및 사용자 피드백 확인
- [ ] 페이지 간 내비게이션 정상 작동
- [ ] 브라우저 콘솔에 치명적 오류 없음

### 🎯 다음 단계

테스트 완료 후:
1. **실제 데이터 입력**: 테스트 데이터 대신 실제 사업장 정보 입력
2. **백업 설정**: 정기적인 데이터베이스 백업 설정
3. **모니터링 설정**: 시스템 상태 모니터링 도구 설정
4. **사용자 교육**: 최종 사용자를 위한 매뉴얼 작성

### 📞 지원

문제가 발생하면:
1. 브라우저 개발자 도구(F12) Console 탭에서 상세 오류 확인
2. Supabase 대시보드의 Logs 섹션에서 서버 오류 확인
3. 이 문서의 문제 해결 섹션 참조