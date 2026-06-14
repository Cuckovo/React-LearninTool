import { View, ActivityIndicator, Platform, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppState } from '@/lib/app-state';

const GEOGEBRA_URI = Platform.OS === 'web'
  ? '/geogebra/GeoGebra.html'
  : 'file:///android_asset/geogebra/GeoGebra.html';

/** 包装 <iframe>：暴露 ggbApplet 和注入绘图命令 */
function GeogebraIframe({ onReady }: { onReady: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);

  // 监听 iframe postMessage，等 GeoGebra ready
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'geogebra:ready') {
        if (!readyRef.current) {
          readyRef.current = true;
          onReady();
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onReady]);

  // 外部通过 ref 调用此方法绘图
  // 用全局对象暴露给 useGeoGebraCommand
  return (
    <iframe
      ref={(el) => {
        iframeRef.current = el;
        // 把 iframe 引用存到全局，方便在其他 hook 中访问
        (window as any).__geogebraIframe = el;
      }}
      src={GEOGEBRA_URI}
      style={{ width: '100%', height: '100%', border: 'none' }}
      title="GeoGebra"
    />
  );
}

/**
 * 监听 plotCommand 并发送给 GeoGebra iframe
 * 通过 window.__geogebraIframe 访问 iframe ref
 */
function useGeoGebraCommand() {
  const { state, dispatch } = useAppState();
  const { plotCommand } = state;
  const lastTimestamp = useRef(0);

  useEffect(() => {
    if (!plotCommand || plotCommand.timestamp === lastTimestamp.current) return;
    lastTimestamp.current = plotCommand.timestamp;

    const iframe = (window as any).__geogebraIframe as HTMLIFrameElement | undefined;
    const win = iframe?.contentWindow;
    if (!win) return;

    // GeoGebra 的全局 API 是 window.ggbApplet
    // postMessage 通知 iframe 内的监听器调用 evalCommand
    win.postMessage(
      JSON.stringify({ type: 'evalCommand', cmd: plotCommand.expression }),
      '*'
    );

    // 同时尝试直接调用（如果 iframe 同源）
    try {
      const ggb = (win as any).ggbApplet;
      if (ggb?.evalCommand) {
        ggb.evalCommand(plotCommand.expression);
      }
    } catch {
      // 跨域保护，静默忽略
    }

    dispatch({ type: 'CLEAR_PLOT_COMMAND' });
  }, [plotCommand, dispatch]);
}

export default function GeoGebraScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  // Web 端监听绘图命令
  useGeoGebraCommand();

  const handleLoadEnd = useCallback(() => setLoading(false), []);
  const handleGeoGebraReady = useCallback(() => setLoading(false), []);

  if (Platform.OS === 'web') {
    return (
      <View className="flex-1 bg-white">
        {loading && (
          <View className="absolute inset-0 justify-center items-center bg-white z-10">
            <ActivityIndicator size="large" color="#90c208" />
          </View>
        )}
        <GeogebraIframe onReady={handleGeoGebraReady} />
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
