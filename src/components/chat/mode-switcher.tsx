/**
 * ModeSwitcher — 模式切换按钮。
 *
 * 在操作按钮行渲染一个「🔄 模式」按钮。
 * 点击后用 Animated 展开/收起一个二级选择列表（绝对定位在按钮上方）。
 * 列表包含：[解题模式（当前）/ 知识库学习]
 * 选择后切换模式 + 新建对应 type 的 session。
 */
import { View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import { useState, useRef, useCallback } from 'react';
import type { ChatMode } from '@/types/knowledge';

interface ModeSwitcherProps {
  currentMode: ChatMode;
  onSwitch: (mode: ChatMode) => void;
  disabled: boolean;
}

const MODE_OPTIONS: { mode: ChatMode; icon: string; label: string }[] = [
  { mode: 'solver', icon: '📐', label: '解题模式' },
  { mode: 'knowledge', icon: '📖', label: '知识库学习' },
];

export default function ModeSwitcher({ currentMode, onSwitch, disabled }: ModeSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  const currentOption = MODE_OPTIONS.find((o) => o.mode === currentMode) ?? MODE_OPTIONS[0];

  const toggleOpen = useCallback(() => {
    if (disabled) return;
    const toValue = isOpen ? 0 : 1;
    setIsOpen(!isOpen);

    Animated.timing(expandAnim, {
      toValue,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [isOpen, disabled, expandAnim]);

  const handleSelect = useCallback((mode: ChatMode) => {
    if (mode !== currentMode) {
      onSwitch(mode);
    }
    // 收起列表
    Animated.timing(expandAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start(() => setIsOpen(false));
  }, [currentMode, onSwitch, expandAnim]);

  // 列表高度
  const listHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 88], // 2 个选项 × 44px
  });
  const listOpacity = expandAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View>
      {/* 触发按钮 */}
      <TouchableOpacity
        className={`flex-row items-center gap-1 rounded-sk-sm px-sk-3 py-1.5 border ${
          disabled ? 'border-sk-border-soft' : 'border-sk-border-soft'
        }`}
        onPress={toggleOpen}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text className="text-sk-xs">{currentOption.icon}</Text>
        <Text className={`text-sk-xs font-semibold ${disabled ? 'text-sk-text-disabled' : 'text-sk-text-secondary'}`}>
          模式
        </Text>
      </TouchableOpacity>

      {/* 展开的二级列表 — 绝对定位在按钮上方 */}
      <Animated.View
        className="absolute bottom-full mb-2 right-0 bg-sk-surface-card rounded-sk-md border border-sk-border-soft shadow-sk-elevated overflow-hidden z-50"
        style={{
          height: listHeight,
          opacity: listOpacity,
          // iOS shadow
          ...(Platform.OS === 'ios' ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
          } : {
            elevation: 6,
          }),
        }}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        {MODE_OPTIONS.map((option) => {
          const isActive = option.mode === currentMode;
          return (
            <TouchableOpacity
              key={option.mode}
              className={`flex-row items-center px-sk-4 py-3 min-w-[160px] ${isActive ? 'bg-brand/10' : ''}`}
              onPress={() => handleSelect(option.mode)}
              activeOpacity={0.7}
            >
              <Text className="text-sk-sm mr-2">{option.icon}</Text>
              <Text
                className={`text-sk-sm flex-1 ${isActive ? 'text-brand font-semibold' : 'text-sk-text-primary'}`}
              >
                {option.label}
              </Text>
              {isActive && (
                <View className="w-2 h-2 rounded-full bg-brand ml-2" />
              )}
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}
