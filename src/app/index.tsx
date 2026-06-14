import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useCallback, useRef, useState, useEffect } from 'react';

const GEOGEBRA_ENTRY = 'geogebra/GeoGebra.html';

/** GeoGebra WebView geogebra-ready 消息类型 */
interface GeogebraReadyMessage {
  type: 'geogebra:ready';
}

export default function GeoGebraScreen() {
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  // 用一个 ref 跟踪 WebView 是否已收到 GeoGebra ready 信号
  const geogebraReadyRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      fetch(`/${GEOGEBRA_ENTRY}`)
        .then((res) => res.text())
        .then((html) => {
          // 注入 postMessage 桥接：GeoGebra 加载完成后通知 RN
          const injectedHtml = html.replace(
            '</body>',
            `<script>
(function() {
  var checkReady = setInterval(function() {
    if (window.renderGGBElementReady || typeof ggbApplet !== 'undefined') {
      clearInterval(checkReady);
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'geogebra:ready' })
      );
    }
  }, 200);
})();
</script></body>`
          );
          setHtmlContent(injectedHtml);
        })
        .catch((err) => {
          console.error('[GeoGebra] HTML fetch 失败:', err);
          setLoading(false);
        });
    }
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as GeogebraReadyMessage;
      if (data.type === 'geogebra:ready') {
        geogebraReadyRef.current = true;
        // 等 GeoGebra 真正 ready 后再隐藏 loading，并额外延迟确保 UI 渲染
        setTimeout(() => setLoading(false), 500);
      }
    } catch {
      // 非 JSON 消息，忽略
    }
  }, []);

  const handleLoadEnd = useCallback(() => {
    // WebView DOM 加载完毕，但 GeoGebra 可能还在初始化
    // 如果 8 秒内没收到 geogebra:ready，也关闭 loading
    setTimeout(() => {
      if (!geogebraReadyRef.current) {
        console.warn('[GeoGebra] 超时未收到 ready 信号，强制关闭 loading');
        setLoading(false);
      }
    }, 8000);
  }, []);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#90c208" />
        </View>
      )}
      {Platform.OS === 'web' && htmlContent ? (
        <WebView
          ref={webViewRef}
          source={{
            html: htmlContent,
            baseUrl: `${window.location.origin}/geogebra/`,
          }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onLoadEnd={handleLoadEnd}
          onMessage={handleMessage}
          originWhitelist={['*']}
        />
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: `file:///android_asset/${GEOGEBRA_ENTRY}` }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          onLoadEnd={handleLoadEnd}
          onMessage={handleMessage}
          originWhitelist={['*']}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
});
