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
  content: string
): Promise<GeminiAnalysisResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `당신은 환경 관련 보조금 공고를 분석하는 전문가입니다.

아래 공고문이 "소규모 대기배출시설 방지시설 IoT(사물인터넷) 설치 지원사업"과 관련있는지 분석해주세요.

## 관련 키워드
- 사물인터넷, IoT
- 소규모 대기배출시설, 대기배출시설
- 방지시설, 대기오염 방지
- 굴뚝 측정기기, TMS, 자동측정
- 환경부, 대기관리, 미세먼지

## 분석 기준
1. 위 키워드가 포함되어 있는지
2. 대기환경 관련 IoT 장비 설치 지원인지
3. 소규모 사업장 대상인지

## 공고 제목
${title}

## 공고 내용
${content.substring(0, 3000)}

## 응답 형식 (JSON만)
{
  "is_relevant": boolean,
  "relevance_score": 0.0~1.0,
  "keywords_matched": ["매칭된", "키워드", "배열"],
  "extracted_info": {
    "application_period_start": "YYYY-MM-DD 또는 null",
    "application_period_end": "YYYY-MM-DD 또는 null",
    "budget": "예산 금액 문자열 또는 null",
    "target_description": "지원대상 설명 또는 null",
    "support_amount": "지원금액 설명 또는 null"
  },
  "reasoning": "판단 근거 한 문장"
}

JSON만 응답하세요.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON 응답을 찾을 수 없습니다.');
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeminiAnalysisResult;

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
    console.error('Gemini 분석 오류:', error);

    // 폴백: 키워드 기반 간단 분석
    const combinedText = `${title} ${content}`.toLowerCase();
    const foundKeywords = RELEVANT_KEYWORDS.filter(kw =>
      combinedText.includes(kw.toLowerCase())
    );

    const isRelevant = foundKeywords.length >= 2;
    const score = Math.min(foundKeywords.length * 0.2, 1);

    return {
      is_relevant: isRelevant,
      relevance_score: score,
      keywords_matched: foundKeywords,
      extracted_info: {},
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
