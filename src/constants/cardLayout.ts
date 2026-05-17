/**
 * 日めくり（ホーム）画面と月間カレンダー画面で共通利用するカード寸法。
 *
 * 以前は両画面で別々に CARD_WIDTH / CARD_HEIGHT を定義しており、
 * ホーム 0.88×0.70、カレンダー 0.90×0.74 と微妙にずれていた。
 * これにより、`inner: justifyContent: 'center'` で中央配置されたカードの
 * 上端位置がタブ切替時にジャンプして見える問題があったため、両画面で同一寸法に統一する。
 */
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** カードの横幅（画面幅の 89%）。ホーム/カレンダー共通。 */
export const CARD_WIDTH = SCREEN_WIDTH * 0.89;

/** カードの縦幅（画面高の 72%）。ホーム/カレンダー共通。 */
export const CARD_HEIGHT = SCREEN_HEIGHT * 0.72;
