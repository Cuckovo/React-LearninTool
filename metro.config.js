const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
config.watchFolders = config.watchFolders || [];
config.watchFolders.push(__dirname + '/public');

// expo-sqlite Web 端依赖 wa-sqlite.wasm，Metro 默认不处理 .wasm 文件
config.resolver.assetExts.push('wasm');

module.exports = withNativeWind(config, { input: './src/global.css' });
