/**
 * LearningTools — Skland 设计 Token（暂存，后续改为 Tailwind 配置）
 */

export const Colors = {
  /** 品牌色 */
  brand: {
    primary: '#90c208',
    light: '#c8eb21',
  },
  /** 文本色 */
  text: {
    primary: '#222222',
    secondary: 'rgba(34, 34, 34, 0.7)',
    tertiary: 'rgba(34, 34, 34, 0.5)',
    disabled: 'rgba(34, 34, 34, 0.25)',
    inverse: '#ffffff',
  },
  /** 表面色 */
  surface: {
    page: '#f6f6f6',
    card: '#ffffff',
  },
  /** 边框色 */
  border: {
    soft: 'rgba(0, 0, 0, 0.05)',
    default: 'rgba(0, 0, 0, 0.15)',
    brand: '#90c208',
  },
  /** 功能色 */
  function: {
    success: '#90c208',
    error: '#ff5a47',
    warning: '#ff941a',
    info: '#2bf',
  },
} as const;
