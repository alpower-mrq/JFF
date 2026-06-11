// Lets us import .svg files directly as React components, e.g.
//   import SlotShell from '../assets/slot_shell.svg'
// Swap the .svg file and Metro re-bundles it automatically — no codegen step.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve('./svg-transformer.js'),
  };
  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...resolver.sourceExts, 'svg'],
  };

  return config;
})();
