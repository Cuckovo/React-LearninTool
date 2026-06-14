import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useCallback, useRef, useState } from 'react';

/** GeoGebra 入口 HTML 相对路径 */
const GEOGEBRA_ENTRY = 'geogebra/GeoGebra.html';

function getGeogebraUri(): string {
  if (Platform.OS === 'web') {
    // Web 端：直接请求 assets 下的静态文件
    return `/${GEOGEBRA_ENTRY}`;
  }
  // Android：从 APK assets 加载
  return `file:///android_asset/${GEOGEBRA_ENTRY}`;
}

export default function GeoGebraScreen() {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
  }, []);

  const sourceUri = getGeogebraUri();

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#90c208" />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: sourceUri }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        allowFileAccessFromFileURLs={true}
        mixedContentMode="always"
        onLoadEnd={handleLoadEnd}
        originWhitelist={['*']}
      />
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
