// utils/facility-keywords.ts - 방지시설 키워드 관리
export const preventionKeywords = [
  // 일반적인 방지시설
  '집진', '여과', '흡착', '세정', '촉매', '연소', '방지', '처리', '정화', '탈취',
  '제거', '분리', '포집', '회수', '중화', '산화', '환원', '냉각', '응축',
  
  // 구체적인 설비명
  '백필터', '백하우스', '사이클론', '스크러버', '활성탄', '흡수탑', 'RTO', 'RCO', 'TCO',
  '세정탑', '연소탑', '산화탑', '환원탑', '중화탑', '냉각탑', '응축기', '침전조',
  '원심분리기', '전기집진기', '습식집진기', '건식집진기', '막분리',
  
  // 영어 키워드
  'filter', 'scrubber', 'tower', 'bag', 'cyclone', 'carbon', 'adsorber',
  'absorber', 'oxidizer', 'incinerator', 'cooler', 'condenser', 'separator',
  'precipitator', 'collector', 'cleaner', 'washer', 'stripper',
  
  // 복합 키워드
  '집진기', '여과기', '흡착기', '세정기', '처리기', '정화기', '탈취기',
  '분리기', '포집기', '회수기', '중화기', '산화기', '환원기', '냉각기',
  
  // 특수 용어
  'baghouse', 'bagfilter', 'wetscruber', 'dryscruber', 'electrostatic',
  'ESP', 'FGD', 'SCR', 'SNCR', 'VOC', 'HAP', 'PM',
  
  // 한국 환경 용어
  '대기방지시설', '먼지제거시설', '가스제거시설', '악취방지시설', 
  '휘발성유기화합물', '질소산화물', '황산화물', '염화수소', '불소화합물'
];

export const dischargeKeywords = [
  // 배출 관련
  '배출', '발생', '생산', '제조', '공정', '가공', '처리', '도장', '건조', '소성',
  '용해', '용접', '절단', '연마', '분쇄', '혼합', '반응', '증발', '증류',
  
  // 설비명
  '시설', '설비', '장치', '기계', '라인', '공정', '단위', '부문',
  '노', '로', '탱크', '반응기', '건조기', '소성로', '용해로',
  
  // 영어
  'facility', 'equipment', 'process', 'line', 'unit', 'furnace', 'kiln',
  'reactor', 'dryer', 'tank', 'vessel', 'chamber'
];

// 키워드 매칭 함수
export function classifyFacility(facilityName: string): 'prevention' | 'discharge' | 'unknown' {
  const name = facilityName.toLowerCase().trim();
  
  // 방지시설 키워드 확인
  for (const keyword of preventionKeywords) {
    if (name.includes(keyword.toLowerCase())) {
      return 'prevention';
    }
  }
  
  // 배출시설 키워드 확인
  for (const keyword of dischargeKeywords) {
    if (name.includes(keyword.toLowerCase())) {
      return 'discharge';
    }
  }
  
  return 'unknown';
}

// 키워드 신뢰도 계산
export function getFacilityConfidence(facilityName: string): {
  type: 'prevention' | 'discharge' | 'unknown';
  confidence: number;
  matchedKeywords: string[];
} {
  const name = facilityName.toLowerCase().trim();
  let preventionMatches: string[] = [];
  let dischargeMatches: string[] = [];
  
  // 방지시설 키워드 매칭
  for (const keyword of preventionKeywords) {
    if (name.includes(keyword.toLowerCase())) {
      preventionMatches.push(keyword);
    }
  }
  
  // 배출시설 키워드 매칭
  for (const keyword of dischargeKeywords) {
    if (name.includes(keyword.toLowerCase())) {
      dischargeMatches.push(keyword);
    }
  }
  
  if (preventionMatches.length > dischargeMatches.length) {
    return {
      type: 'prevention',
      confidence: Math.min(preventionMatches.length * 0.3, 1.0),
      matchedKeywords: preventionMatches
    };
  } else if (dischargeMatches.length > 0) {
    return {
      type: 'discharge',
      confidence: Math.min(dischargeMatches.length * 0.3, 1.0),
      matchedKeywords: dischargeMatches
    };
  } else {
    return {
      type: 'unknown',
      confidence: 0,
      matchedKeywords: []
    };
  }
}
