import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GeminiAnalysisResult } from '@/types/subsidy';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY || '');

// IoT 지원사업 관련 키워드
const RELEVANT_KEYWORDS = [
  '사물인터넷', 'IoT', 'iot',
  '소규모 대기배출시설', '대기배출시설', '배출시설',
  '방지시설', '대기오염', '대기환경',
  '굴뚝', '측정기기', '자동측정', 'TMS',
  '환경부', '대기관리', '미세먼지',
  '보조금', '지원사업', '설치지원',
];

/**
 * Gemini AI를 사용하여 공고문 관련성 분석
 */
export async function analyzeAnnouncement(
  title: string,
  content: string,
  sourceUrl?: string
): Promise<GeminiAnalysisResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `당신은 환경 관련 보조금 공고를 분석하는 전문가입니다.

아래 공고문이 "소규모 대기배출시설 방지시설 IoT(사물인터넷) 설치 지원사업"과 관련있는지 분석하고, 중요 정보를 추출해주세요.

## 공고 제목
${title}

## 공고 내용
${content.substring(0, 4000)}

## 추출해야 할 정보
1. **신청기간**: "신청", "접수", "모집" 등의 키워드와 함께 나오는 날짜 (시작일과 마감일)
2. **예산**: "예산", "총사업비", "지원규모" 등의 키워드와 함께 나오는 금액
3. **지원대상**: 누가 신청할 수 있는지
4. **지원금액**: 개별 지원금액, 지원비율 등

## 날짜 추출 규칙
- "2025.1.10 ~ 2025.3.15" 형식이면 start: "2025-01-10", end: "2025-03-15"
- "2025년 1월 10일부터 3월 15일까지" 형식도 동일하게 처리
- 날짜는 반드시 YYYY-MM-DD 형식으로 변환
- 날짜를 찾을 수 없으면 null

## 응답 형식 (반드시 JSON만 출력)
{
  "is_relevant": true 또는 false,
  "relevance_score": 0.0~1.0 사이 숫자,
  "keywords_matched": ["IoT", "사물인터넷", ...],
  "extracted_info": {
    "application_period_start": "2025-01-10" 또는 null,
    "application_period_end": "2025-03-15" 또는 null,
    "budget": "5억원" 또는 "500,000,000원" 또는 null,
    "target_description": "소규모 대기배출사업장" 또는 null,
    "support_amount": "최대 1,000만원 (70%)" 또는 null
  },
  "reasoning": "판단 근거 설명"
}

**중요**: 위 JSON 형식만 출력하세요. 다른 설명이나 마크다운은 포함하지 마세요.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log('✅ Gemini AI 응답 받음 (길이:', text.length, ')');

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ JSON 파싱 실패 - 응답:', text);
      throw new Error('JSON 응답을 찾을 수 없습니다.');
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeminiAnalysisResult;
    console.log('📊 파싱 결과:', {
      is_relevant: parsed.is_relevant,
      score: parsed.relevance_score,
      has_period_start: !!parsed.extracted_info?.application_period_start,
      has_period_end: !!parsed.extracted_info?.application_period_end,
      has_budget: !!parsed.extracted_info?.budget,
    });

    // 키워드 기반 추가 검증
    const combinedText = `${title} ${content}`.toLowerCase();
    const foundKeywords = RELEVANT_KEYWORDS.filter(kw =>
      combinedText.includes(kw.toLowerCase())
    );

    // AI 분석과 키워드 검색 결합
    if (foundKeywords.length > 0 && !parsed.is_relevant) {
      // 키워드가 있지만 AI가 무관하다고 판단한 경우 - 낮은 점수로 관련 처리
      parsed.is_relevant = foundKeywords.length >= 2;
      parsed.relevance_score = Math.max(parsed.relevance_score, foundKeywords.length * 0.15);
    }

    // 매칭 키워드 병합
    const allKeywords = [...new Set([...parsed.keywords_matched, ...foundKeywords])];
    parsed.keywords_matched = allKeywords;

    return parsed;

  } catch (error) {
    console.error('❌ Gemini 분석 오류:', error);
    console.error('   제목:', title);
    console.error('   내용 길이:', content.length);

    // 폴백: 키워드 기반 간단 분석
    const combinedText = `${title} ${content}`.toLowerCase();
    const foundKeywords = RELEVANT_KEYWORDS.filter(kw =>
      combinedText.includes(kw.toLowerCase())
    );

    const isRelevant = foundKeywords.length >= 2;
    const score = Math.min(foundKeywords.length * 0.2, 1);

    // 🔍 간단한 날짜/예산 추출 시도 (폴백용)
    const extractedInfo: any = {};

    // 날짜 패턴 추출 (YYYY.MM.DD, YYYY-MM-DD, YYYY년 MM월 DD일)
    const datePattern = /(\d{4})[.\-년]\s?(\d{1,2})[.\-월]\s?(\d{1,2})/g;
    const dateMatches = [...content.matchAll(datePattern)];
    if (dateMatches.length >= 2) {
      const [year1, month1, day1] = dateMatches[0].slice(1);
      const [year2, month2, day2] = dateMatches[1].slice(1);
      extractedInfo.application_period_start = `${year1}-${month1.padStart(2, '0')}-${day1.padStart(2, '0')}`;
      extractedInfo.application_period_end = `${year2}-${month2.padStart(2, '0')}-${day2.padStart(2, '0')}`;
    }

    // 예산 패턴 추출 (억원, 백만원 등)
    const budgetPattern = /([\d,]+)\s?(억|백만|천만)?\s?원/;
    const budgetMatch = content.match(budgetPattern);
    if (budgetMatch) {
      extractedInfo.budget = budgetMatch[0];
    }

    console.log('   폴백 추출 정보:', extractedInfo);

    return {
      is_relevant: isRelevant,
      relevance_score: score,
      keywords_matched: foundKeywords,
      extracted_info: extractedInfo,
      reasoning: `키워드 기반 분석 (Gemini 오류): ${foundKeywords.length}개 키워드 발견`,
    };
  }
}

/**
 * 날짜 문자열 정규화
 */
export function normalizeDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;

  // 다양한 한국어 날짜 형식 처리
  const patterns = [
    /(\d{4})[.\-/년](\d{1,2})[.\-/월](\d{1,2})/, // 2024.01.15, 2024년 1월 15일
    /(\d{4})(\d{2})(\d{2})/, // 20240115
  ];

  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  return null;
}
