# 카카오내비 지오코딩 구현 완료

## 📋 구현 개요

카카오 로컬 API를 사용하여 주소를 좌표로 변환한 후, 카카오내비 앱으로 경로 안내를 실행하는 기능을 구현했습니다.

## 🔍 문제 분석

### 기존 문제점
1. **카카오내비 URL 스킴 한계**
   - `kakaonavi://search?q=주소` 형식은 공식 지원하지 않음
   - 카카오내비는 **좌표 기반 경로 안내만 지원**
   - 주소 텍스트로 직접 검색 불가능

2. **티맵과 네이버지도는 정상 작동**
   - `tmap://search?name=주소` ✅ 주소 검색 지원
   - `nmap://search?query=주소` ✅ 주소 검색 지원
   - `kakaonavi://search?q=주소` ❌ 지원하지 않음

### 해결 방안
**카카오 로컬 API**를 사용하여:
1. 주소 → 좌표 변환 (지오코딩)
2. 좌표 기반 카카오내비 URL 생성
3. 변환 실패 시 카카오맵으로 폴백

## 📁 구현 파일

### 1. 지오코딩 유틸리티: `utils/geocoding.ts` (신규 생성)

```typescript
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  success: boolean;
  coordinates?: Coordinates;
  error?: string;
}

// 주요 함수
export async function addressToCoordinates(address: string): Promise<GeocodingResult>
export async function batchAddressToCoordinates(addresses: string[]): Promise<GeocodingResult[]>
```

**주요 기능:**
- 카카오 로컬 API (`https://dapi.kakao.com/v2/local/search/address.json`) 호출
- REST API 키를 Authorization 헤더에 포함: `KakaoAK ${REST_API_KEY}`
- 주소 유효성 검증 및 에러 처리
- 배치 처리 지원 (여러 주소 동시 변환)

### 2. 연락처 유틸리티 업데이트: `utils/contact.ts`

**변경 사항:**

1. **카카오맵으로 변경 (임시)**
   ```typescript
   kakao: `kakaomap://search?q=${encodedAddress}` // 주소 검색 지원
   ```

2. **카카오내비 비동기 함수 추가 (신규)**
   ```typescript
   export async function createKakaoNaviLink(address: string): Promise<string | null> {
     const result = await addressToCoordinates(address);
     if (result.success && result.coordinates) {
       const { lat, lng } = result.coordinates;
       return `kakaonavi://route?ep=${lat},${lng}&by=CAR`;
     } else {
       // 폴백: 카카오맵 검색
       return `kakaomap://search?q=${encodeURIComponent(address)}`;
     }
   }
   ```

### 3. 환경변수 설정: `.env.local`

```env
# Kakao Local API (지오코딩)
NEXT_PUBLIC_KAKAO_REST_API_KEY=YOUR_KAKAO_REST_API_KEY_HERE
```

## 🔧 API 사용법

### 카카오 로컬 API 엔드포인트

**GET** `https://dapi.kakao.com/v2/local/search/address.json`

**헤더:**
```
Authorization: KakaoAK ${REST_API_KEY}
```

**파라미터:**
- `query` (필수): 검색할 주소 (예: "서울특별시 강남구 테헤란로 123")
- `analyze_type` (선택): `similar` (기본값) 또는 `exact`
- `page` (선택): 결과 페이지 번호 (1-45, 기본값: 1)
- `size` (선택): 페이지당 결과 수 (1-30, 기본값: 10)

**응답 예시:**
```json
{
  "documents": [
    {
      "x": "127.027610",  // 경도
      "y": "37.497942",   // 위도
      "address_name": "서울 강남구 삼성동 100",
      "road_address": { ... }
    }
  ]
}
```

## 🎯 URL 스킴 비교

| 앱 | URL 스킴 형식 | 주소 검색 지원 |
|----|--------------|--------------|
| **티맵** | `tmap://search?name=주소` | ✅ 지원 |
| **네이버지도** | `nmap://search?query=주소` | ✅ 지원 |
| **카카오맵** | `kakaomap://search?q=주소` | ✅ 지원 |
| **카카오내비** | `kakaonavi://route?ep=위도,경도&by=CAR` | ❌ 좌표만 지원 |

## 📝 사용 예시

### 기본 사용 (동기)
```typescript
import { createNavigationLinks } from '@/utils/contact';

const links = createNavigationLinks("서울특별시 강남구 테헤란로 123");
// {
//   tmap: "tmap://search?name=...",
//   naver: "nmap://search?query=...",
//   kakao: "kakaomap://search?q=..."  // 카카오맵
// }
```

### 카카오내비 사용 (비동기)
```typescript
import { createKakaoNaviLink } from '@/utils/contact';

const kakaoNaviUrl = await createKakaoNaviLink("서울특별시 강남구 테헤란로 123");
// 성공: "kakaonavi://route?ep=37.497942,127.027610&by=CAR"
// 실패: "kakaomap://search?q=서울특별시+강남구+테헤란로+123" (폴백)
```

## ⚠️ 주의사항

### 1. REST API 키 발급 필요
- **카카오 개발자 콘솔**: https://developers.kakao.com
- 앱 생성 → REST API 키 발급
- `.env.local`에 `NEXT_PUBLIC_KAKAO_REST_API_KEY` 설정

### 2. 카카오맵 API 사용 설정 (2024년 12월 1일부터)
- 앱 관리 페이지 → [카카오맵] → [사용 설정] → [상태] ON

### 3. 비동기 함수 호출
- `createKakaoNaviLink()`는 **async 함수**이므로 `await` 필요
- UI 컴포넌트에서 사용 시 상태 관리 필요

### 4. 에러 처리
- 네트워크 오류, API 키 없음, 주소 찾을 수 없음 등
- 자동 폴백: 카카오맵 검색으로 대체

## 🔄 향후 개선 사항

### 1. 컴포넌트 통합
현재 `BusinessInfoSection.tsx`는 동기 함수 사용:
```typescript
const links = createNavigationLinks(address);
```

카카오내비 사용 시 비동기 처리 필요:
```typescript
const [kakaoNaviLink, setKakaoNaviLink] = useState<string | null>(null);

useEffect(() => {
  createKakaoNaviLink(address).then(setKakaoNaviLink);
}, [address]);
```

### 2. 좌표 캐싱
- 동일 주소 반복 조회 방지
- LocalStorage 또는 메모리 캐시 활용

### 3. 일괄 변환
- 사업장 목록 로딩 시 모든 주소를 미리 변환
- `batchAddressToCoordinates()` 활용

### 4. 사용자 피드백
- 지오코딩 진행 중 로딩 표시
- 변환 실패 시 명확한 에러 메시지

## ✅ 테스트 체크리스트

- [ ] 카카오 REST API 키 발급 및 `.env.local` 설정
- [ ] 카카오맵 API 사용 설정 ON
- [ ] 개발 서버 재시작 (`npm run dev`)
- [ ] 주소 → 좌표 변환 테스트
  ```typescript
  import { addressToCoordinates } from '@/utils/geocoding';

  const result = await addressToCoordinates("서울특별시 강남구 테헤란로 123");
  console.log(result); // { success: true, coordinates: { lat: 37.497942, lng: 127.027610 } }
  ```
- [ ] 카카오내비 URL 생성 테스트
  ```typescript
  import { createKakaoNaviLink } from '@/utils/contact';

  const url = await createKakaoNaviLink("서울특별시 강남구 테헤란로 123");
  console.log(url); // "kakaonavi://route?ep=37.497942,127.027610&by=CAR"
  ```
- [ ] 모바일 환경에서 실제 앱 실행 테스트

## 🎉 완료 상태

- ✅ `utils/geocoding.ts` 생성 (지오코딩 유틸리티)
- ✅ `utils/contact.ts` 업데이트 (카카오내비 URL 생성)
- ✅ `.env.local` 환경변수 추가
- ✅ 문서화 완료
- ⏳ REST API 키 발급 필요 (사용자 작업)
- ⏳ UI 컴포넌트 통합 (선택 사항)

## 📅 구현 완료일
2025-12-01

## 🔗 관련 문서
- [카카오 로컬 API 공식 문서](https://developers.kakao.com/docs/latest/ko/local/dev-guide)
- [카카오내비 Android 가이드](https://developers.kakao.com/docs/latest/ko/kakaonavi/android)
