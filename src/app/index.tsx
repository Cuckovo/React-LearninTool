import { View, ActivityIndicator, Platform, Text } from 'react-native';
import { WebView } from 'react-native-webview';
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

  // 响应来自 AI 对话页面的绘图命令
  useEffect(() => {
    if (!plotCommand) return;

    try {
      if (Platform.OS === 'web') {
        // Web: 通过 postMessage 发送给 iframe 内的 GeoGebra
        const win = iframeRef.current?.contentWindow;
        if (win) {
          // 直接 postMessage 字符串命令给 GeoGebra 的 iframe 消息监听器
          win.postMessage(JSON.stringify({ type: 'evalCommand', cmd: plotCommand.expression }), '*');
        }
      } else {
        // Android: 通过 injectJavaScript 直接调用 GeoGebra API
        webViewRef.current?.injectJavaScript(`
          (function(){
            try {
              if (typeof ggbApplet !== 'undefined' && ggbApplet.evalCommand) {
                ggbApplet.evalCommand('${plotCommand.expression.replace(/'/g, "\\'")}');
              }
            } catch(e) {
              console.log('ggbApplet evalCommand error:', e);
            }
          })();
          true;
        `);
      }
    } catch (err) {
      console.error('[GeoGebra] plot error:', err);
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
        <iframe
          ref={(el) => { iframeRef.current = el; }}
          src={GEOGEBRA_URI}
          onLoad={handleIframeLoad}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="GeoGebra"
        />
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
