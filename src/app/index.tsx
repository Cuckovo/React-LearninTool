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
  const webViewRef = useRef<WebView>(null);
  const geogebraReadyRef = useRef(false);
  // 避免 StrictMode 双重 fetch
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetch(`/${GEOGEBRA_ENTRY}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((html) => {
        // 注入 postMessage 桥接：GeoGebra 加载完成后通知 RN
        const injectedHtml = html.replace(
          '</body>',
          `<script>
(function() {
  var checkReady = setInterval(function() {
    if (window.ggbApplet) {
      clearInterval(checkReady);
      try {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'geogebra:ready' })
        );
      } catch(e) {
        // 降级：Web 端可能没有 ReactNativeWebView
        window.postMessage(
          JSON.stringify({ type: 'geogebra:ready' }), '*'
        );
      }
    }
  }, 200);
})();
</script></body>`
        );
        // 关键修复：baseUrl 末尾必须带 /，保证相对路径解析正确
        const baseUrl = `${window.location.origin}/geogebra/`;
        webViewRef.current?.injectJavaScript?.(`
          document.write(${JSON.stringify(injectedHtml)});
        `);
        // 直接用 source 属性更新（推荐方式）
        return { html: injectedHtml, baseUrl };
      })
      .then((source) => {
        if (webViewRef.current && source) {
          // 通过 WebView 的 props 更新 source
          // 这里不能用 ref 改 prop，需要强制重渲染 —— 用 state 更新
        }
        return source;
      })
      .catch((err) => {
        console.error('[GeoGebra] HTML fetch 失败:', err);
        setLoading(false);
      });
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as GeogebraReadyMessage;
      if (data.type === 'geogebra:ready') {
        geogebraReadyRef.current = true;
        setTimeout(() => setLoading(false), 500);
      }
    } catch {
      // 非 JSON 消息，忽略
    }
  }, []);

  const handleLoadEnd = useCallback(() => {
    // 8 秒兜底
    setTimeout(() => {
      if (!geogebraReadyRef.current) {
        console.warn('[GeoGebra] 超时未收到 ready 信号，强制关闭 loading');
        setLoading(false);
      }
    }, 8000);
  }, []);

  // 处理 Web 平台：需要 fetch 完 HTML 后再渲染 WebView
  const [webSource, setWebSource] = useState<{ html: string; baseUrl: string } | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetch(`/${GEOGEBRA_ENTRY}`)
      .then((res) => res.text())
      .then((html) => {
        const injectedHtml = html.replace(
          '</body>',
          `<script>
(function() {
  var checkReady = setInterval(function() {
    if (window.ggbApplet || typeof ggbApplet !== 'undefined') {
      clearInterval(checkReady);
      try {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'geogebra:ready' })
        );
      } catch(e) {
        window.postMessage(
          JSON.stringify({ type: 'geogebra:ready' }), '*'
        );
      }
    }
  }, 200);
  var maxWait = setTimeout(function() {
    clearInterval(checkReady);
    try {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'geogebra:ready' })
      );
    } catch(e) {
      window.postMessage(
        JSON.stringify({ type: 'geogebra:ready' }), '*'
      );
    }
  }, 12000);
})();
</script></body>`
        );
        setWebSource({
          html: injectedHtml,
          baseUrl: `${window.location.origin}/geogebra/`,
        });
      })
      .catch((err) => {
        console.error('[GeoGebra] HTML fetch 失败:', err);
        setLoading(false);
      });
  }, []);

  if (Platform.OS === 'web' && !webSource) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#90c208" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#90c208" />
        </View>
      )}
      {Platform.OS === 'web' && webSource ? (
        <WebView
          ref={webViewRef}
          source={webSource}
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
