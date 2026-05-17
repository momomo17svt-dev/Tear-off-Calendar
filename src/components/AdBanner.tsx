import React from 'react';
import { Platform, View, StyleSheet, Text } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function AdBanner() {
  if (isExpoGo) {
    // Expo Go環境ではネイティブモジュールがないため、エラーを回避してプレースホルダーを表示します
    return (
      <View style={[styles.container, styles.placeholder]}>
        <Text style={styles.placeholderText}>広告エリア（Expo Goでは非表示）</Text>
      </View>
    );
  }

  // 開発ビルドや本番アプリでのみモジュールを読み込む
  const { BannerAd, BannerAdSize, TestIds } = require('react-native-google-mobile-ads');

  // 実際のリリース時には、AdMobの管理画面で取得した各OSのバナー広告ユニットIDに置き換えます。
  const adUnitId = __DEV__
    ? TestIds.BANNER
    : Platform.select({
        ios: 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy', // TODO: iOS用の実際の広告ユニットID
        android: 'ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz', // TODO: Android用の実際の広告ユニットID
        default: '',
      });

  if (!adUnitId) return null;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          console.log('Ad loaded');
        }}
        onAdFailedToLoad={(error: any) => {
          console.error('Ad failed to load', error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  placeholder: {
    height: 50,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    width: 320,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
  }
});
