import {
  StyleSheet,
  View,
  ActivityIndicator,
  Platform,
  Text,
} from 'react-native';
import { useRef, useEffect } from 'react';
import { WebView, type WebView as WebViewType } from 'react-native-webview';
import { useCallback, useState } from 'react';
import { useAppState } from '@/lib/app-state';

const GEOGEBRA_URI = Platform.OS === 'web'
  ? '/geogebra/GeoGebra.html'
  : 'file:///android_asset/geogebra/GeoGebra.html';

export default function GeoGebraScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { state, dispatch } = useAppState();
  const { plotCommand } = state;
  const webViewRef = useRef<WebViewType>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
  }, []);

  const handleIframeLoad = useCallback(() => {
    setLoading(false);
  }, []);

  // 响应来自 AI 对话页面的绘图命令
  useEffect(() => {
    if (!plotCommand) return;

    try {
      if (Platform.OS === 'web') {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              type: 'plot',
              expression: plotCommand.expression,
            },
            '*'
          );
        }
      } else {
        webViewRef.current?.injectJavaScript(`
          (function() {
            try {
              var expr = ${JSON.stringify(plotCommand.expression)};
              window.postMessage({ type: 'plot', expression: expr }, '*');
              true;
            } catch(e) { false; }
          })();
        `);
      }
    } finally {
      dispatch({ type: 'CLEAR_PLOT_COMMAND' });
    }
  }, [plotCommand, dispatch]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#90c208" />
          </View>
        )}
        <iframe
          ref={(el) => {
            iframeRef.current = el;
          }}
          src={GEOGEBRA_URI}
          onLoad={handleIframeLoad}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title="GeoGebra"
        />
      </View>
    );
  }

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
        ref={webViewRef}
        source={{ uri: GEOGEBRA_URI }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        allowFileAccessFromFileURLs
        onLoadEnd={handleLoadEnd}
        onError={(e) => {
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
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  errorText: { color: '#ff5a47', fontSize: 16 },
});
