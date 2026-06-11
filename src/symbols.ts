import { ImageSourcePropType } from 'react-native';

// The 12 slot symbols, sliced from the Figma sprite sheet.
export const SYMBOLS = {
  coin: require('../assets/symbols/coin.png'),
  gem: require('../assets/symbols/gem.png'),
  bar: require('../assets/symbols/bar.png'),
  token: require('../assets/symbols/token.png'),
  chest: require('../assets/symbols/chest.png'),
  energy: require('../assets/symbols/energy.png'),
  seven: require('../assets/symbols/seven.png'),
  bell: require('../assets/symbols/bell.png'),
  horseshoe: require('../assets/symbols/horseshoe.png'),
  clover: require('../assets/symbols/clover.png'),
  star: require('../assets/symbols/star.png'),
  wild: require('../assets/symbols/wild.png'),
} as const satisfies Record<string, ImageSourcePropType>;

export type SymbolKey = keyof typeof SYMBOLS;

export const SYMBOL_KEYS = Object.keys(SYMBOLS) as SymbolKey[];

export const randomSymbol = (): SymbolKey =>
  SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)];
