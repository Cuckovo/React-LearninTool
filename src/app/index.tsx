import { StyleSheet, View, ActivityIndicator, Platform, Text } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useCallback, useRef, useState } from 'react';

export default function GeoGebraScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const readyFlag = useRef(false);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'geogebra:ready') {
        readyFlag.current = true;
        setLoading(false);
      }
    } catch {}
  }, []);

  const handleLoadEnd = useCallback(() => {
    setTimeout(() => {
      if (!readyFlag.current) setLoading(false);
    }, 5000);
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>加载失败: {error}</Text>
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
      <WebView
        source={{
          uri: Platform.OS === 'web'
            ? `${window.location.origin}/geogebra/GeoGebra.html`
            : `file:///android_asset/geogebra/GeoGebra.html`,
        }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        allowFileAccessFromFileURLs
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        onError={(e) => {
          console.error('[GeoGebra] WebView error:', e.nativeEvent);
          setError(e.nativeEvent.description);
        }}
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  errorText: { color: '#ff5a47', fontSize: 16 },
});
