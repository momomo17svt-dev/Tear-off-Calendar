const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

/**
 * Expo Config Plugin: iOS HealthKit 連携に必要な entitlement と Info.plist を追加する。
 * EAS Build 時に自動適用される。
 */
module.exports = function withHealthKit(config) {
  // HealthKit entitlement を追加
  config = withEntitlementsPlist(config, (c) => {
    c.modResults['com.apple.developer.healthkit'] = true;
    return c;
  });

  // NSHealthShareUsageDescription / NSHealthUpdateUsageDescription を Info.plist に追加
  config = withInfoPlist(config, (c) => {
    c.modResults.NSHealthShareUsageDescription =
      c.modResults.NSHealthShareUsageDescription ??
      'ヘルスケアデータ（歩数・睡眠・心拍数など）を日記に記録・表示するためにアクセスを許可してください。';
    c.modResults.NSHealthUpdateUsageDescription =
      c.modResults.NSHealthUpdateUsageDescription ??
      'ヘルスケアデータを記録するためにアクセスを許可してください。';
    return c;
  });

  return config;
};
