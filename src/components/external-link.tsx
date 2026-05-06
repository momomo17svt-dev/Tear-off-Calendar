import { Href, Link } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type ComponentProps } from 'react';

/**
 * 外部リンクリクエスト用コンポーネント
 * Webブラウザでは通常のリンクとして動作し、
 * ネイティブ（iOS/Android）ではアプリ内ブラウザ（SFSafariViewController / Chrome Custom Tabs）を開きます。
 */

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string };

export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== 'web') {
          // ネイティブ環境では、デフォルトのブラウザアプリに遷移するのを防ぎます。
          event.preventDefault();
          // 代わりにアプリ内ブラウザでリンクを開きます。
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}
    />
  );
}
