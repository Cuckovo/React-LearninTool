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
  const lastTimestamp = useRef(0);

  // 监听绘图命令
  useEffect(() => {
    if (!plotCommand || plotCommand.timestamp === lastTimestamp.current) return;
    lastTimestamp.current = plotCommand.timestamp;

    // 同源直调 ggbApplet
    try {
      const iframe = (window as any).__geogebraIframe as HTMLIFrameElement | undefined;
      const win = iframe?.contentWindow;
      const ggb = win ? (win as any).ggbApplet : undefined;
      if (ggb?.evalCommand) {
        ggb.evalCommand(plotCommand.expression);
        console.log('[GeoGebra] evalCommand:', plotCommand.expression);
      } else {
        console.warn('[GeoGebra] ggbApplet not ready, will retry');
        // 5 秒后重试
        setTimeout(() => {
          const retryGgb = (win as any).ggbApplet;
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

  const handleIframeLoad = useCallback(() => {
    setLoading(false);
    console.log('[GeoGebra] iframe loaded');
    // 给 GeoGebra 足够的初始化时间
    setTimeout(() => {
      const iframe = (window as any).__geogebraIframe as HTMLIFrameElement | undefined;
      const ggb = iframe?.contentWindow ? (iframe.contentWindow as any).ggbApplet : undefined;
      console.log('[GeoGebra] ggbApplet available:', !!ggb);
    }, 3000);
  }, []);

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
        source={{ uri: GEOGEBRA_URI }}
        className="flex-1"
        javaScriptEnabled domStorageEnabled allowFileAccess allowUniversalAccessFromFileURLs allowFileAccessFromFileURLs
        onLoadEnd={() => setLoading(false)}
        onError={(e) => setError(e.nativeEvent.description)}
        originWhitelist={['*']}
      />
    </View>
  );
}
