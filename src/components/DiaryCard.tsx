/**
 * 日記リストの1行を表示するカードコンポーネント。
 * リスト再レンダリング負荷を抑えるため React.memo で包む。
 */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

function DiaryCardImpl({ diary, showDate, isDarkMode, onPress }: DiaryCardProps) {
  const c = getThemeColors(isDarkMode);
  const hasImages = diary.imageUris.length > 0;
  const hasTags = diary.tags.length > 0;
  // タイトルが空でも見出しが必要なので、本文先頭 20 文字で代替する
  const displayTitle = diary.title.trim() || diary.content.trim().slice(0, 20) || '（無題）';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}
      onPress={() => onPress(diary)}
      activeOpacity={0.85}
    >
      {/* ── 上段: 日付（任意）と時刻 ── */}
      <View style={styles.headerRow}>
        {showDate && (
          <Text style={[styles.dateLabel, { color: c.textSub }]}>{diary.date}</Text>
        )}
        <Text style={[styles.timeLabel, { color: c.textSub }]}>
          {formatTime(diary.createdAt)}
        </Text>
      </View>

      {/* ── タイトル ── */}
      <Text
        style={[styles.title, { color: c.textMain }]}
        numberOfLines={1}
      >
        {displayTitle}
      </Text>

      {/* ── 本文プレビュー（2行）── */}
      {diary.content.trim().length > 0 && (
        <Text
          style={[styles.content, { color: c.textSub }]}
          numberOfLines={2}
        >
          {diary.content}
        </Text>
      )}

      {/* ── 画像サムネイル横スクロール ── */}
      {hasImages && (
        <View style={styles.thumbRow}>
          {diary.imageUris.slice(0, 4).map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={styles.thumb}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
            />
          ))}
          {diary.imageUris.length > 4 && (
            <View style={[styles.thumb, styles.thumbMore, { backgroundColor: c.binding }]}>
              <Text style={[styles.thumbMoreText, { color: c.textSub }]}>
                +{diary.imageUris.length - 4}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── タグチップ ── */}
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
    </TouchableOpacity>
  );
}

export const DiaryCard = React.memo(DiaryCardImpl);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
  thumbRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  thumbMore: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
