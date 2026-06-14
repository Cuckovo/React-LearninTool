/**
 * Expo 自定义 Metro 配置
 * 将 public/ 目录内容 serve 为静态资源
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 把 public/ 加入 watchFolders，这样 Metro 开发服务器能 serve 这些文件
config.watchFolders = config.watchFolders || [];
config.watchFolders.push(__dirname + '/public');

module.exports = config;
