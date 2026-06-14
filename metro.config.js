const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
config.watchFolders = config.watchFolders || [];
config.watchFolders.push(__dirname + '/public');

module.exports = withNativeWind(config, { input: './src/global.css' });
