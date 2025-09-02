// utils/contact.ts - 연락처 관련 유틸리티 함수들

// 전화번호에서 특수문자 제거하고 전화걸기 링크 생성
export function createPhoneLink(phoneNumber: string): string {
  if (!phoneNumber) return '';
  
  // 공백, 하이픈, 괄호 등 제거하고 숫자만 남김
  const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
  
  // 010으로 시작하는 휴대폰 번호나 일반 전화번호
  if (cleanNumber.length >= 10) {
    return `tel:${cleanNumber}`;
  }
  
  return '';
}

// 주소를 각 네비게이션 앱 URL로 변환
export function createNavigationLinks(address: string) {
  if (!address || address.trim() === '' || address === '정보 없음') {
    return null;
  }

  const encodedAddress = encodeURIComponent(address.trim());
  
  return {
    tmap: `tmap://route?goalname=목적지&goalx=0&goaly=0&reqCoordType=WGS84GEO&goalAddr=${encodedAddress}`,
    naver: `nmap://route/public?dlat=0&dlng=0&dname=${encodedAddress}&appname=com.facility.manager`,
    kakao: `kakaomap://route?ep=${encodedAddress}&by=PUBLICTRANSIT`
  };
}

// 네비게이션 앱이 설치되어 있는지 확인하는 함수 (웹에서는 제한적)
export function openNavigation(address: string) {
  const links = createNavigationLinks(address);
  
  if (!links) {
    alert('주소 정보가 없습니다.');
    return;
  }

  // 모바일 환경 체크
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (!isMobile) {
    // PC에서는 네이버 지도 웹 버전으로
    window.open(`https://map.naver.com/v5/search/${encodeURIComponent(address)}`, '_blank');
    return;
  }

  // 모바일에서는 선택 다이얼로그 표시
  const choice = confirm('네비게이션 앱을 선택하세요.\n확인: 티맵\n취소: 네이버지도');
  
  if (choice) {
    // 티맵 시도
    window.location.href = links.tmap;
    
    // 티맵이 없으면 카카오맵으로 fallback
    setTimeout(() => {
      window.location.href = links.kakao;
    }, 2000);
  } else {
    // 네이버지도 시도
    window.location.href = links.naver;
    
    // 네이버지도가 없으면 웹 버전으로 fallback
    setTimeout(() => {
      window.open(`https://map.naver.com/v5/search/${encodeURIComponent(address)}`, '_blank');
    }, 2000);
  }
}