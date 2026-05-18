/**
 * Open-Meteo 天気データ取得ユーティリティ
 *
 * - APIキー不要・完全無料
 * - 予報 (forecast) と過去データ (archive) の両エンドポイントに対応
 * - WMO 天気コードを日本語 + 絵文字に変換する関数を提供
 */

export interface DayWeatherData {
  date: string;              // YYYY-MM-DD
  weatherCode: number;       // WMO code
  tempMax: number;           // °C
  tempMin: number;           // °C
  precipProbability: number; // % (0-100)
}

// ── WMO 天気コード → 絵文字 + 日本語 ──────────────────────────────────────

const WMO_MAP: Record<number, { emoji: string; label: string }> = {
  0:  { emoji: '☀️',  label: '快晴' },
  1:  { emoji: '🌤️', label: '晴れ' },
  2:  { emoji: '⛅',  label: '晴れ時々曇り' },
  3:  { emoji: '☁️',  label: '曇り' },
  45: { emoji: '🌫️', label: '霧' },
  48: { emoji: '🌫️', label: '霧' },
  51: { emoji: '🌦️', label: '霧雨' },
  53: { emoji: '🌦️', label: '霧雨' },
  55: { emoji: '🌦️', label: '霧雨' },
  61: { emoji: '🌧️', label: '雨' },
  63: { emoji: '🌧️', label: '雨' },
  65: { emoji: '🌧️', label: '大雨' },
  71: { emoji: '🌨️', label: '雪' },
  73: { emoji: '🌨️', label: '雪' },
  75: { emoji: '❄️',  label: '大雪' },
  77: { emoji: '🌨️', label: '霧雪' },
  80: { emoji: '🌦️', label: 'にわか雨' },
  81: { emoji: '🌦️', label: 'にわか雨' },
  82: { emoji: '🌧️', label: '激しいにわか雨' },
  85: { emoji: '🌨️', label: 'にわか雪' },
  86: { emoji: '🌨️', label: 'にわか雪' },
  95: { emoji: '⛈️',  label: '雷雨' },
  96: { emoji: '⛈️',  label: '雷雨（雹あり）' },
  99: { emoji: '⛈️',  label: '雷雨（雹あり）' },
};

export function wmoInfo(code: number): { emoji: string; label: string } {
  return WMO_MAP[code] ?? { emoji: '🌡️', label: '不明' };
}

// ── API 呼び出し ──────────────────────────────────────────────────────────

interface OpenMeteoResponse {
  daily: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
}

function parseDailyResponse(json: OpenMeteoResponse): DayWeatherData[] {
  const d = json.daily;
  return d.time.map((date, i) => ({
    date,
    weatherCode: d.weathercode[i],
    tempMax: Math.round(d.temperature_2m_max[i]),
    tempMin: Math.round(d.temperature_2m_min[i]),
    precipProbability: d.precipitation_probability_max[i] ?? 0,
  }));
}

/**
 * 予報 API（今日〜最大 16 日先）
 */
export async function fetchForecast(
  lat: number,
  lon: number,
  days = 16
): Promise<DayWeatherData[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=Asia%2FTokyo&forecast_days=${days}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo forecast error: ${res.status}`);
  const json: OpenMeteoResponse = await res.json();
  return parseDailyResponse(json);
}

/**
 * 過去データ API（指定日付範囲）
 */
export async function fetchArchive(
  lat: number,
  lon: number,
  startDate: string, // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
): Promise<DayWeatherData[]> {
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lon}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=Asia%2FTokyo`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo archive error: ${res.status}`);
  const json: OpenMeteoResponse = await res.json();
  return parseDailyResponse(json);
}

// ── 日付ユーティリティ ─────────────────────────────────────────────────────

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
