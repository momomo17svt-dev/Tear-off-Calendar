/**
 * 天気データ管理用グローバルストア (Zustand)
 *
 * - expo-location で端末の位置情報を取得（権限なしは graceful に無効化）
 * - Open-Meteo API で予報 (今日〜+16日) と過去データ (-7日〜昨日) を取得
 * - 日付ごとのデータをセッション中キャッシュ
 */
import * as Location from 'expo-location';
import { create } from 'zustand';

import {
  addDays,
  fetchArchive,
  fetchForecast,
  toISODate,
  type DayWeatherData,
} from '@/utils/weather';

interface WeatherState {
  location: { lat: number; lon: number } | null;
  locationGranted: boolean;
  cache: Record<string, DayWeatherData>; // YYYY-MM-DD → data
  isReady: boolean;

  initWeather: () => Promise<void>;
  getForDate: (dateStr: string) => DayWeatherData | null;
  fetchForDate: (dateStr: string) => Promise<void>;
}

export const useWeatherStore = create<WeatherState>((set, get) => ({
  location: null,
  locationGranted: false,
  cache: {},
  isReady: false,

  /**
   * アプリ起動時に呼ぶ初期化処理。
   * 位置情報を取得し、今日を中心に ±7〜16 日分の天気を一括フェッチしてキャッシュする。
   */
  initWeather: async () => {
    try {
      // 位置情報の権限確認（まだ未確認なら OS ダイアログを出す）
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ isReady: true }); // 天気なしでも他の機能は動作する
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      set({ location: { lat, lon }, locationGranted: true });

      const today = new Date();

      // 予報（今日〜+16日）と過去（-7日〜昨日）を並列フェッチ
      const archiveStart = toISODate(addDays(today, -7));
      const archiveEnd   = toISODate(addDays(today, -1));

      const [forecastData, archiveData] = await Promise.all([
        fetchForecast(lat, lon, 16).catch(() => [] as DayWeatherData[]),
        // 過去データは archive API を呼ぶ。当日が 1 日以上前でない場合はスキップ
        archiveStart < archiveEnd
          ? fetchArchive(lat, lon, archiveStart, archiveEnd).catch(() => [] as DayWeatherData[])
          : Promise.resolve([] as DayWeatherData[]),
      ]);

      const newCache: Record<string, DayWeatherData> = {};
      for (const d of [...archiveData, ...forecastData]) {
        newCache[d.date] = d;
      }
      set({ cache: newCache, isReady: true });
    } catch {
      set({ isReady: true }); // 通信失敗でも他の機能は動作する
    }
  },

  getForDate: (dateStr) => get().cache[dateStr] ?? null,

  /**
   * キャッシュにない日付を単体で取得する（スワイプで遠い日付に移動した際など）。
   */
  fetchForDate: async (dateStr) => {
    const { location, cache } = get();
    if (!location || cache[dateStr]) return;

    const today = toISODate(new Date());
    try {
      let data: DayWeatherData[];
      if (dateStr <= today) {
        data = await fetchArchive(location.lat, location.lon, dateStr, dateStr);
      } else {
        // 予報は最大 16 日先まで。それ以上は何もしない
        const maxForecast = toISODate(addDays(new Date(), 16));
        if (dateStr > maxForecast) return;
        data = await fetchForecast(location.lat, location.lon, 16);
      }
      const newCache = { ...get().cache };
      for (const d of data) newCache[d.date] = d;
      set({ cache: newCache });
    } catch {
      // 取得失敗は無視（天気なし表示のまま）
    }
  },
}));
