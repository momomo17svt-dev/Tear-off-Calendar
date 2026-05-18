/**
 * 日記リストの1行を表示するカードコンポーネント。
 * 画像がある日記は SNS（Instagram）風レイアウトで、画像を主役にカード幅いっぱいの 1:1 カルーセル表示。
 * リスト再レンダリング負荷を抑えるため React.memo で包む。
 */
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Diary } from '@/types/diary';
import { getThemeColors } from '@/utils/theme';

interface DiaryCardProps {
  diary: Diary;
  /** リスト先頭に対象日付を表示したい時に渡す。検索結果では true 推奨。 */
  showDate?: boolean;
  isDarkMode: boolean;
  onPress: (diary: Diary) => void;
}

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * 画像カルーセル本体。
 * - カード幅いっぱいの 1:1 ScrollView（pagingEnabled）
 * - 右上に「2 / 5」バッジ、下部にドットインジケーター
 * - 1枚しかない場合はカルーセル化せず単一画像として描画
 */
function ImageCarousel({ uris }: { uris: string[] }) {
  const [width, setWidth] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== currentIndex) setCurrentIndex(idx);
  };

  if (uris.length === 1) {
    return (
      <View
        style={styles.carouselWrap}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <Image
            source={{ uri: uris[0] }}
            style={{ width, height: width }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
          />
        )}
      </View>
    );
  }

  return (
    <View
      style={styles.carouselWrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumEnd}
            // 親 TouchableOpacity の onPress と競合しないよう、最初の数pxのスクロールで主導権を取る
            scrollEventThrottle={16}
          >
            {uris.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={{ width, height: width }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
              />
            ))}
          </ScrollView>

          {/* インデックスバッジ（右上） */}
          <View style={styles.indexBadge} pointerEvents="none">
            <Text style={styles.indexBadgeText}>
              {currentIndex + 1} / {uris.length}
            </Text>
          </View>

          {/* ドットインジケーター（下部中央） */}
          <View style={styles.dotsRow} pointerEvents="none">
            {uris.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function DiaryCardImpl({ diary, showDate, isDarkMode, onPress }: DiaryCardProps) {
  const c = getThemeColors(isDarkMode);
  const hasImages = diary.imageUris.length > 0;
  const hasTags = diary.tags.length > 0;
  // タイトルが空でも見出しが必要なので、本文先頭 20 文字で代替する
  const displayTitle = diary.title.trim() || diary.content.trim().slice(0, 20) || '（無題）';
  const handlePress = () => onPress(diary);

  // カード全体を Touchable でラップしないのは、ネストした横 ScrollView のスワイプを
  // 親が奪って画像切り替えがしづらくなるため。タップ判定は画像以外のエリアに分離する。
  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      {/* ── 上段: 日付（任意）と時刻（タップで編集モーダル）── */}
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress}>
        <View style={styles.headerRow}>
          {showDate && (
            <Text style={[styles.dateLabel, { color: c.textSub }]}>{diary.date}</Text>
          )}
          <Text style={[styles.timeLabel, { color: c.textSub }]}>
            {formatTime(diary.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>

      {/* ── 画像メイン（SNS 風カルーセル / スワイプ専用）── */}
      {hasImages && <ImageCarousel uris={diary.imageUris} />}

      {/* ── 本文ブロック（タップで編集モーダル）── */}
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress}>
        <View style={styles.body}>
          <Text
            style={[styles.title, { color: c.textMain }]}
            numberOfLines={1}
          >
            {displayTitle}
          </Text>

          {diary.content.trim().length > 0 && (
            <Text
              style={[styles.content, { color: c.textSub }]}
              numberOfLines={2}
            >
              {diary.content}
            </Text>
          )}

          {hasTags && (
            <View style={styles.tagRow}>
              {diary.tags.slice(0, 5).map((tag) => (
                <View
                  key={tag}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: isDarkMode ? 'rgba(10,126,164,0.18)' : 'rgba(10,126,164,0.10)',
                      borderColor: isDarkMode ? 'rgba(10,126,164,0.35)' : 'rgba(10,126,164,0.25)',
                    },
                  ]}
                >
                  <Text style={[styles.tagText, { color: isDarkMode ? '#7DD3FC' : '#0a7ea4' }]}>
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export const DiaryCard = React.memo(DiaryCardImpl);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden', // カルーセルがカード角からはみ出さないように
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 'auto',
  },

  // ── 画像カルーセル ──
  carouselWrap: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  indexBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  indexBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#fff',
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  // ── 本文ブロック ──
  body: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  content: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
