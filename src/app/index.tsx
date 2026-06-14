import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useCallback, useRef, useState, useEffect } from 'react';

/** GeoGebra 入口 HTML 相对路径 */
const GEOGEBRA_ENTRY = 'geogebra/GeoGebra.html';

export default function GeoGebraScreen() {
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    // Web 开发模式：fetch GeoGebra HTML 内联注入
    // Metro 不直接 serve assets/，所以从 public/ 抓取
    if (Platform.OS === 'web') {
      fetch(`/${GEOGEBRA_ENTRY}`)
        .then((res) => res.text())
        .then((html) => setHtmlContent(html))
        .catch((err) => {
          console.error('[GeoGebra] HTML fetch 失败:', err);
          setLoading(false);
        });
    }
  }, []);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
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
