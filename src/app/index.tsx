import { View, ActivityIndicator, Platform, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppState } from '@/lib/app-state';
import { SafeAreaView } from 'react-native-safe-area-context';

const GEOGEBRA_URI = Platform.OS === 'web'
  ? '/geogebra/GeoGebra.html'
  : 'file:///android_asset/geogebra/GeoGebra.html';

export default function GeoGebraScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { state, dispatch } = useAppState();
  const { plotCommand } = state;
  const lastTimestamp = useRef(0);
  const webViewRef = useRef<WebView>(null);

  // Android: 通过 WebView ref 的 injectJavaScript 直接调用 ggbApplet
  useEffect(() => {
    if (Platform.OS === 'web') return; // Web 端走 iframe 方案
    if (!plotCommand || plotCommand.timestamp === lastTimestamp.current) return;
    lastTimestamp.current = plotCommand.timestamp;

    try {
      const expr = plotCommand.expression.replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(`
        (function(){
          try {
            if (typeof ggbApplet !== 'undefined' && ggbApplet.evalCommand) {
              ggbApplet.evalCommand('${expr}');
            } else {
              // ggbApplet 还没就绪，等 3 秒重试
              setTimeout(function() {
                if (typeof ggbApplet !== 'undefined' && ggbApplet.evalCommand) {
                  ggbApplet.evalCommand('${expr}');
                }
              }, 3000);
            }
          } catch(e) {
            console.log('ggbApplet error:', e);
          }
        })();
        true;
      `);
    } catch (err) {
      console.error('[GeoGebra] inject error:', err);
    }

    dispatch({ type: 'CLEAR_PLOT_COMMAND' });
  }, [plotCommand, dispatch]);

  // Web 端: 同源直调 ggbApplet
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!plotCommand || plotCommand.timestamp === lastTimestamp.current) return;
    lastTimestamp.current = plotCommand.timestamp;

    try {
      const iframe = (window as any).__geogebraIframe as HTMLIFrameElement | undefined;
      const win = iframe?.contentWindow;
      const ggb = win ? (win as any).ggbApplet : undefined;
      if (ggb?.evalCommand) {
        ggb.evalCommand(plotCommand.expression);
      } else {
        console.warn('[GeoGebra] ggbApplet not ready, retry in 5s');
        setTimeout(() => {
          const retryGgb = win ? (win as any).ggbApplet : undefined;
          if (retryGgb?.evalCommand) {
            retryGgb.evalCommand(plotCommand.expression);
          }
        }, 5000);
      }
    } catch (err) {
      console.error('[GeoGebra] plot error:', err);
    }

    dispatch({ type: 'CLEAR_PLOT_COMMAND' });
  }, [plotCommand, dispatch]);

  const handleIframeLoad = useCallback(() => setLoading(false), []);
  const handleWebViewLoad = useCallback(() => setLoading(false), []);

  if (Platform.OS === 'web') {
    return (
      <View className="flex-1 bg-white">
        {loading && (
          <View className="absolute inset-0 justify-center items-center bg-white z-10">
            <ActivityIndicator size="large" color="#90c208" />
          </View>
        )}
        <iframe
          ref={(el) => { (window as any).__geogebraIframe = el; }}
          src={GEOGEBRA_URI}
          onLoad={handleIframeLoad}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="GeoGebra"
        />
      </View>
    );
  }

  // Android
  if (error) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <Text className="text-sk-function-error text-sk-md">加载失败: {error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
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
        onLoadEnd={handleWebViewLoad}
        onError={(e) => setError(e.nativeEvent.description)}
        originWhitelist={['*']}
      />
    </SafeAreaView>
  );
}
