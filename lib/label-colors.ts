/**
 * 라벨 색상 유틸리티
 * 라벨 텍스트를 기반으로 일관된 색상을 생성합니다.
 */

/**
 * 문자열을 해시하여 숫자로 변환
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * 라벨 색상 조합 (배경색/텍스트색)
 * 가독성을 위해 밝은 배경에 어두운 텍스트 조합 사용
 */
const colorCombinations = [
  { bg: 'bg-red-100', text: 'text-red-800' },
  { bg: 'bg-orange-100', text: 'text-orange-800' },
  { bg: 'bg-amber-100', text: 'text-amber-800' },
  { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  { bg: 'bg-lime-100', text: 'text-lime-800' },
  { bg: 'bg-green-100', text: 'text-green-800' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  { bg: 'bg-teal-100', text: 'text-teal-800' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  { bg: 'bg-sky-100', text: 'text-sky-800' },
  { bg: 'bg-blue-100', text: 'text-blue-800' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  { bg: 'bg-violet-100', text: 'text-violet-800' },
  { bg: 'bg-purple-100', text: 'text-purple-800' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800' },
  { bg: 'bg-pink-100', text: 'text-pink-800' },
  { bg: 'bg-rose-100', text: 'text-rose-800' },
];

/**
 * 라벨 텍스트를 기반으로 일관된 색상을 반환
 * 같은 라벨은 항상 같은 색상을 가짐 (해시 기반)
 *
 * @param label - 라벨 텍스트
 * @returns Tailwind CSS 클래스 (bg, text)
 */
export function getLabelColor(label: string): {
  bg: string;
  text: string;
} {
  const hash = hashString(label);
  const colorIndex = hash % colorCombinations.length;
  return colorCombinations[colorIndex];
}
