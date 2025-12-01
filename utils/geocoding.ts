// utils/geocoding.ts - 카카오 로컬 API를 사용한 지오코딩 유틸리티

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  success: boolean;
  coordinates?: Coordinates;
  error?: string;
}

/**
 * 카카오 로컬 API를 사용하여 주소를 좌표로 변환
 * @param address - 변환할 주소 (예: "서울특별시 강남구 테헤란로 123")
 * @returns 좌표 정보 또는 에러
 */
export async function addressToCoordinates(address: string): Promise<GeocodingResult> {
  // 주소 유효성 검증
  if (!address || address.trim() === '' || address === '정보 없음') {
    return {
      success: false,
      error: '유효하지 않은 주소입니다.'
    };
  }

  try {
    const KAKAO_REST_API_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;

    console.log('[Geocoding] 디버그 - API 키 존재 여부:', !!KAKAO_REST_API_KEY);
    console.log('[Geocoding] 디버그 - API 키 앞 4자리:', KAKAO_REST_API_KEY?.substring(0, 4));

    if (!KAKAO_REST_API_KEY) {
      console.error('[Geocoding] 카카오 REST API 키가 설정되지 않았습니다.');
      return {
        success: false,
        error: 'API 키가 설정되지 않았습니다.'
      };
    }

    const encodedAddress = encodeURIComponent(address.trim());
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodedAddress}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });

    if (!response.ok) {
      console.error('[Geocoding] API 요청 실패:', response.status, response.statusText);
      return {
        success: false,
        error: `API 요청 실패: ${response.status}`
      };
    }

    const data = await response.json();

    // 결과가 없는 경우
    if (!data.documents || data.documents.length === 0) {
      console.warn('[Geocoding] 주소를 찾을 수 없습니다:', address);
      return {
        success: false,
        error: '주소를 찾을 수 없습니다.'
      };
    }

    // 첫 번째 결과의 좌표 추출
    const firstResult = data.documents[0];
    const coordinates: Coordinates = {
      lat: parseFloat(firstResult.y), // 위도
      lng: parseFloat(firstResult.x)  // 경도
    };

    console.log(`[Geocoding] 주소 변환 성공: ${address} → (${coordinates.lat}, ${coordinates.lng})`);

    return {
      success: true,
      coordinates
    };

  } catch (error) {
    console.error('[Geocoding] 지오코딩 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 여러 주소를 동시에 좌표로 변환 (배치 처리)
 * @param addresses - 변환할 주소 배열
 * @returns 각 주소에 대한 좌표 결과 배열
 */
export async function batchAddressToCoordinates(addresses: string[]): Promise<GeocodingResult[]> {
  return Promise.all(addresses.map(address => addressToCoordinates(address)));
}
