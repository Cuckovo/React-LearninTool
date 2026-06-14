import { StyleSheet, View, ActivityIndicator, Platform, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useCallback, useRef, useState } from 'react';

const GEOGEBRA_URI = Platform.OS === 'web'
  ? '/geogebra/GeoGebra.html'
  : 'file:///android_asset/geogebra/GeoGebra.html';

/**
 * Web 端用原生 <iframe>，绕过 react-native-webview 在 Web 端的 iframe 限制
 */
function GeogebraIframe() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <iframe
      ref={iframeRef}
      src={GEOGEBRA_URI}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        flex: 1,
      }}
      title="GeoGebra"
      sandbox="allow-scripts allow-same-origin allow-forms"
    />
  );
}

export default function GeoGebraScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLoadEnd = useCallback(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#90c208" />
          </View>
        )}
        <GeogebraIframe />
        {/* 用隐藏 WebView 仅用于监听 load */}
        <WebView
          source={{ uri: GEOGEBRA_URI }}
          style={{ height: 0, width: 0, position: 'absolute', opacity: 0 }}
          onLoadEnd={handleLoadEnd}
          originWhitelist={['*']}
        />
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
        source={{ uri: GEOGEBRA_URI }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        allowFileAccessFromFileURLs
        onLoadEnd={handleLoadEnd}
        onError={(e) => {
          console.error('[GeoGebra] error:', e.nativeEvent);
          setError(e.nativeEvent.description);
        }}
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
});
