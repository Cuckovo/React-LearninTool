import { StyleSheet, View, ActivityIndicator, Platform, Text } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppState } from '@/lib/app-state';

const GEOGEBRA_URI = Platform.OS === 'web'
  ? '/geogebra/GeoGebra.html'
  : 'file:///android_asset/geogebra/GeoGebra.html';

export default function GeoGebraScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { state, dispatch } = useAppState();
  const { plotCommand } = state;
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const handleLoadEnd = useCallback(() => setLoading(false), []);
  const handleIframeLoad = useCallback(() => setLoading(false), []);

  useEffect(() => {
    if (!plotCommand) return;
    try {
      if (Platform.OS === 'web') {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'plot', expression: plotCommand.expression }, '*');
        }
      } else {
        webViewRef.current?.injectJavaScript(`(function(){ try { window.postMessage({ type: 'plot', expression: ${JSON.stringify(plotCommand.expression)} }, '*'); } catch(e) {} })();`);
      }
    } finally {
      dispatch({ type: 'CLEAR_PLOT_COMMAND' });
    }
  }, [plotCommand, dispatch]);

  if (Platform.OS === 'web') {
    return (
      <View className="flex-1 bg-white">
        {loading && (
          <View className="absolute inset-0 justify-center items-center bg-white z-10">
            <ActivityIndicator size="large" color="#90c208" />
          </View>
        )}
        <iframe ref={(el) => { iframeRef.current = el; }} src={GEOGEBRA_URI} onLoad={handleIframeLoad} style={{ width: '100%', height: '100%', border: 'none' }} title="GeoGebra" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-sk-function-error text-sk-md">加载失败: {error}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {loading && (
        <View className="absolute inset-0 justify-center items-center bg-white z-10">
          <ActivityIndicator size="large" color="#90c208" />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: GEOGEBRA_URI }}
        className="flex-1"
        javaScriptEnabled domStorageEnabled allowFileAccess allowUniversalAccessFromFileURLs allowFileAccessFromFileURLs
        onLoadEnd={handleLoadEnd}
        onError={(e) => setError(e.nativeEvent.description)}
        originWhitelist={['*']}
      />
    </View>
  );
}
