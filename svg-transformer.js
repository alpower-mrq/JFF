// Wraps react-native-svg-transformer so raw Figma SVG exports "just work".
//
// Figma applies inner-/drop-shadow filters (`filter="url(#..._i_...)"`) that
// react-native-svg can't render — it ends up dropping the filled element (e.g.
// an outline-only banner). We strip just the `filter` url() refs (clip-paths,
// gradients, masks, fills are untouched), then hand off to the normal transformer.
const upstream = require('react-native-svg-transformer/expo');

module.exports.transform = function transform(args) {
  if (args && args.filename && args.filename.endsWith('.svg') && typeof args.src === 'string') {
    args = {
      ...args,
      src: args.src.replace(/\sfilter="url\(#[^"]*\)"/g, ''),
    };
  }
  return upstream.transform(args);
};
