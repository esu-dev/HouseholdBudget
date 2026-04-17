const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// 'wasm' をアセット拡張子に追加
config.resolver.assetExts.push('wasm');

module.exports = withNativeWind(config, { input: "./global.css" });

