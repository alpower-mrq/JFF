import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, View } from 'react-native';
import { SYMBOLS, SymbolKey, randomSymbol } from './symbols';

// react-native-web animates fine in JS but never fires the .start() completion
// callback when useNativeDriver is true, so drive on the JS thread on web only.
const USE_NATIVE = Platform.OS !== 'web';

const K0 = 2; // strip index shown at the top of the window when resting
const SCROLL = 18; // number of cells travelled during a spin
const BOTTOM = 3; // spare rows below the result for the settle overshoot
const LEN = K0 + SCROLL + 3 + BOTTOM;

export type Triple = [SymbolKey, SymbolKey, SymbolKey];
export type ReelHandle = {
  spin: (result: Triple, duration: number) => Promise<void>;
};

const randStrip = (): SymbolKey[] => Array.from({ length: LEN }, randomSymbol);

// A resting strip with `result` shown in the window (indices K0..K0+2).
function resting(result: Triple): SymbolKey[] {
  const s = randStrip();
  s[K0] = result[0];
  s[K0 + 1] = result[1];
  s[K0 + 2] = result[2];
  return s;
}

type Props = { cell: number; width: number; initial: Triple; shiftY?: number };

/**
 * One reel column. Shows 3 symbols. `spin(result, duration)` scrolls the strip
 * up through a run of random symbols and ticks to a stop on `result`, then
 * seamlessly normalises back to the resting layout (no visible jump) so the
 * next spin starts clean. Resolves when the reel has settled.
 */
const Reel = forwardRef<ReelHandle, Props>(({ cell, width, initial, shiftY = 0 }, ref) => {
  const [strip, setStrip] = useState<SymbolKey[]>(() => resting(initial));
  const [spinning, setSpinning] = useState(false);
  const animY = useRef(new Animated.Value(-K0 * cell - shiftY)).current;

  useImperativeHandle(
    ref,
    () => ({
      spin(result, duration) {
        return new Promise<void>((resolve) => {
          // Keep the currently-visible symbols at K0..K0+2 so the first frame
          // doesn't jump; drop the new result far down the strip (off-screen).
          setStrip((prev) => {
            const s = randStrip();
            s[K0] = prev[K0];
            s[K0 + 1] = prev[K0 + 1];
            s[K0 + 2] = prev[K0 + 2];
            const f = K0 + SCROLL;
            s[f] = result[0];
            s[f + 1] = result[1];
            s[f + 2] = result[2];
            return s;
          });
          animY.setValue(-K0 * cell - shiftY);
          setSpinning(true);

          const restY = -(K0 + SCROLL) * cell - shiftY;
          const overshoot = cell * 0.16;
          Animated.sequence([
            // decelerate, overshooting the stop slightly...
            Animated.timing(animY, {
              toValue: restY - overshoot,
              duration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: USE_NATIVE,
            }),
            // ...then tick back into place
            Animated.timing(animY, {
              toValue: restY,
              duration: 280,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: USE_NATIVE,
            }),
          ]).start();

          // Drive completion off a timer rather than Animated's .start()
          // callback (which doesn't fire reliably under react-native-web).
          setTimeout(() => {
            // Normalise: the result moves back to the resting window and the
            // static translateY takes over in the same commit -> no flicker.
            setStrip(resting(result));
            setSpinning(false);
            resolve();
          }, duration + 280 + 40);
        });
      },
    }),
    [cell, animY, shiftY]
  );

  const translateY = spinning ? animY : -K0 * cell - shiftY;

  return (
    <View style={{ width, height: cell * 3, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        {strip.map((k, i) => (
          <View
            key={i}
            style={{
              width,
              height: cell,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image
              source={SYMBOLS[k]}
              style={{ width: width * 0.78, height: cell * 0.78 }}
              resizeMode="contain"
            />
          </View>
        ))}
      </Animated.View>
    </View>
  );
});

Reel.displayName = 'Reel';
export default Reel;
