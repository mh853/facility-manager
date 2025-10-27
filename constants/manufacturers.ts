// 제조사 영어-한글 매핑 테이블
export const MANUFACTURER_NAMES = {
  ecosense: '에코센스',
  cleanearth: '크린어스',
  gaia_cns: '가이아씨앤에스',
  evs: '이브이에스'
} as const;

// 제조사 한글-영어 역매핑 테이블
export const MANUFACTURER_NAMES_REVERSE = {
  '에코센스': 'ecosense',
  '크린어스': 'cleanearth',
  '가이아씨앤에스': 'gaia_cns',
  '이브이에스': 'evs'
} as const;

export type ManufacturerCode = keyof typeof MANUFACTURER_NAMES;
export type ManufacturerName = typeof MANUFACTURER_NAMES[ManufacturerCode];

// 영어 코드 → 한글 이름 변환
export function getManufacturerName(code: ManufacturerCode): ManufacturerName {
  return MANUFACTURER_NAMES[code];
}

// 한글 이름 → 영어 코드 변환
export function getManufacturerCode(name: ManufacturerName): ManufacturerCode {
  return MANUFACTURER_NAMES_REVERSE[name];
}
