/**
 * KnowledgePage — 知识库 Tab 响应式容器。
 *
 * 响应式布局：
 *   width < 768: 手机端 — Animated.View 左右切换（大纲页 ↔ 详情页）
 *   width >= 768: 宽屏 — Row布局，左侧大纲(flex:0.4) + 右侧详情(flex:0.6)
 *
 * 状态：selectedNodeId (当前选中的叶子节点)，初始 null（显示大纲页）
 */
import { View, Animated, PanResponder, useWindowDimensions } from 'react-native';
import { useState, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import OutlinePage from '@/components/knowledge/outline-page';
import DetailPage from '@/components/knowledge/detail-page';

const WIDE_THRESHOLD = 768;
const SWIPE_THRESHOLD = 80;

interface SelectionState {
  nodeId: string;
  nodeLabel: string;
  nodeDefinition: string | null;
}

export default function KnowledgePage() {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= WIDE_THRESHOLD;

  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const showDetailRef = useRef(false);

  // 手机端滑动动画
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  // 选择叶子节点
  const handleSelectNode = useCallback((nodeId: string, label: string, definition: string | null) => {
    setSelection({ nodeId, nodeLabel: label, nodeDefinition: definition });

    if (!isWideScreen) {
      // 手机端：动画滑到详情页
      setShowDetail(true);
      showDetailRef.current = true;
      isAnimating.current = true;
      Animated.spring(slideAnim, {
        toValue: -width,
        useNativeDriver: true,
        speed: 14,
        bounciness: 0,
      }).start(() => { isAnimating.current = false; });
    }
  }, [isWideScreen, width, slideAnim]);

  // 返回大纲页
  const handleBack = useCallback(() => {
    if (!isWideScreen) {
      isAnimating.current = true;
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 0,
      }).start(() => {
        setShowDetail(false);
        showDetailRef.current = false;
        isAnimating.current = false;
      });
    } else {
      setSelection(null);
    }
  }, [isWideScreen, slideAnim]);

  // 手机端：PanResponder 手势（只判断左右方向）
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // 只响应水平方向的手势
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (isAnimating.current) return;

        if (gestureState.dx > SWIPE_THRESHOLD && showDetailRef.current) {
          // 右滑 → 回到大纲
          handleBack();
        } else if (gestureState.dx < -SWIPE_THRESHOLD && !showDetailRef.current) {
          // 左滑 → 无操作（需要选择节点才能进入详情）
        }
      },
    }),
  ).current;

  // ── 宽屏布局 ──
  if (isWideScreen) {
    return (
      <SafeAreaView className="flex-1 bg-sk-surface-page" edges={['top']}>
        <View className="flex-1 flex-row">
          {/* 左侧大纲 */}
          <View className="flex-[0.4] border-r border-sk-border-soft">
            <OutlinePage
              onSelectNode={handleSelectNode}
              selectedNodeId={selection?.nodeId ?? null}
            />
          </View>

          {/* 右侧详情 */}
          <View className="flex-[0.6]">
            {selection ? (
              <DetailPage
                nodeId={selection.nodeId}
                nodeLabel={selection.nodeLabel}
                nodeDefinition={selection.nodeDefinition}
                onBack={handleBack}
                isWideScreen={true}
              />
            ) : (
              <View className="flex-1 justify-center items-center bg-sk-surface-page">
                <View className="items-center px-sk-8">
                  <View className="text-4xl mb-4">
                    <Animated.Text>👈</Animated.Text>
                  </View>
                  <View>
                    <Animated.Text className="text-sk-text-tertiary text-sk-md">从左侧大纲选择一个知识点</Animated.Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── 手机端布局：滑动导航 ──
  return (
    <SafeAreaView className="flex-1 bg-sk-surface-page" edges={['top']}>
      <View className="flex-1" style={{ overflow: 'hidden' }}>
        <Animated.View
          className="flex-1"
          style={{
            flexDirection: 'row',
            width: width * 2,
            transform: [{ translateX: slideAnim }],
          }}
          {...panResponder.panHandlers}
        >
          {/* 大纲页 */}
          <View style={{ width }}>
            <OutlinePage
              onSelectNode={handleSelectNode}
              selectedNodeId={selection?.nodeId ?? null}
            />
          </View>

          {/* 详情页 */}
          <View style={{ width }}>
            {selection ? (
              <DetailPage
                nodeId={selection.nodeId}
                nodeLabel={selection.nodeLabel}
                nodeDefinition={selection.nodeDefinition}
                onBack={handleBack}
                isWideScreen={false}
              />
            ) : (
              <View className="flex-1 justify-center items-center bg-sk-surface-page">
                <View className="items-center">
                  <Animated.Text className="text-sk-text-disabled text-sk-sm">选择知识点查看详情</Animated.Text>
                </View>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
