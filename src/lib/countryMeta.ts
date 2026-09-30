/** ISO 3166-1 alpha-2 → 표시명·지도 좌표(위경도) */
export type CountryMeta = { name: string; lat: number; lng: number }

export const COUNTRY_META: Record<string, CountryMeta> = {
  KR: { name: '대한민국', lat: 36.5, lng: 127.8 },
  KP: { name: '북한', lat: 40.0, lng: 127.0 },
  JP: { name: '일본', lat: 36.2, lng: 138.3 },
  CN: { name: '중국', lat: 35.9, lng: 104.2 },
  TW: { name: '대만', lat: 23.7, lng: 121.0 },
  HK: { name: '홍콩', lat: 22.3, lng: 114.2 },
  SG: { name: '싱가포르', lat: 1.35, lng: 103.8 },
  MY: { name: '말레이시아', lat: 4.2, lng: 101.9 },
  TH: { name: '태국', lat: 15.9, lng: 100.9 },
  VN: { name: '베트남', lat: 14.1, lng: 108.3 },
  ID: { name: '인도네시아', lat: -2.5, lng: 118.0 },
  PH: { name: '필리핀', lat: 12.9, lng: 121.8 },
  IN: { name: '인도', lat: 20.6, lng: 78.9 },
  AU: { name: '호주', lat: -25.3, lng: 133.8 },
  NZ: { name: '뉴질랜드', lat: -40.9, lng: 174.9 },
  US: { name: '미국', lat: 39.8, lng: -98.6 },
  CA: { name: '캐나다', lat: 56.1, lng: -106.3 },
  MX: { name: '멕시코', lat: 23.6, lng: -102.6 },
  BR: { name: '브라질', lat: -14.2, lng: -51.9 },
  AR: { name: '아르헨티나', lat: -38.4, lng: -63.6 },
  CL: { name: '칠레', lat: -35.7, lng: -71.5 },
  CO: { name: '콜롬비아', lat: 4.6, lng: -74.3 },
  GB: { name: '영국', lat: 54.0, lng: -2.0 },
  IE: { name: '아일랜드', lat: 53.1, lng: -8.2 },
  FR: { name: '프랑스', lat: 46.2, lng: 2.2 },
  DE: { name: '독일', lat: 51.2, lng: 10.5 },
  IT: { name: '이탈리아', lat: 41.9, lng: 12.6 },
  ES: { name: '스페인', lat: 40.5, lng: -3.7 },
  PT: { name: '포르투갈', lat: 39.4, lng: -8.2 },
  NL: { name: '네덜란드', lat: 52.1, lng: 5.3 },
  BE: { name: '벨기에', lat: 50.5, lng: 4.5 },
  CH: { name: '스위스', lat: 46.8, lng: 8.2 },
  AT: { name: '오스트리아', lat: 47.5, lng: 14.6 },
  SE: { name: '스웨덴', lat: 60.1, lng: 18.6 },
  NO: { name: '노르웨이', lat: 60.5, lng: 8.5 },
  DK: { name: '덴마크', lat: 56.3, lng: 9.5 },
  FI: { name: '핀란드', lat: 61.9, lng: 25.7 },
  PL: { name: '폴란드', lat: 51.9, lng: 19.1 },
  CZ: { name: '체코', lat: 49.8, lng: 15.5 },
  RO: { name: '루마니아', lat: 45.9, lng: 24.9 },
  HU: { name: '헝가리', lat: 47.2, lng: 19.5 },
  GR: { name: '그리스', lat: 39.1, lng: 21.8 },
  TR: { name: '튀르키예', lat: 38.9, lng: 35.2 },
  RU: { name: '러시아', lat: 61.5, lng: 105.3 },
  UA: { name: '우크라이나', lat: 48.4, lng: 31.2 },
  SA: { name: '사우디아라비아', lat: 23.9, lng: 45.1 },
  AE: { name: '아랍에미리트', lat: 23.4, lng: 53.8 },
  IL: { name: '이스라엘', lat: 31.0, lng: 34.9 },
  EG: { name: '이집트', lat: 26.8, lng: 30.8 },
  ZA: { name: '남아프리카', lat: -30.6, lng: 22.9 },
  NG: { name: '나이지리아', lat: 9.1, lng: 8.7 },
  KE: { name: '케냐', lat: -0.0, lng: 37.9 },
  UNKNOWN: { name: '미상/미지정', lat: -55, lng: 0 }
}

export function countryLabel(code: string): string {
  const c = (code || 'UNKNOWN').toUpperCase()
  return COUNTRY_META[c]?.name || c
}

export function countryCoords(code: string): { lat: number; lng: number } {
  const c = (code || 'UNKNOWN').toUpperCase()
  const m = COUNTRY_META[c]
  if (m) return { lat: m.lat, lng: m.lng }
  // 알 수 없는 코드: 해상 중립 지점
  return { lat: 0, lng: 0 }
}

/** mapa.svg viewBox 0 0 950 620 기준 equirectangular */
export const MAP_W = 950
export const MAP_H = 620

export function projectLngLat(lng: number, lat: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * MAP_W
  const y = ((90 - lat) / 180) * MAP_H
  return { x, y }
}
