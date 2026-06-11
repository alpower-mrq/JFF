import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  DimensionValue,
  Easing,
  Image,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
// Whole SVGs, imported directly — swap any file and it updates automatically.
import SlotShell from '../assets/slot_shell.svg';
import CloudBg from '../assets/cloud_bg.svg';
import SpinButtonBase from '../assets/spin_button_base.svg';
import SpinButtonKey from '../assets/spin_button_key.svg';
import Sunburst from '../assets/sunburst.svg';
import CloseIcon from '../assets/close.svg';
import { useAudioPlayer } from 'expo-audio';
import Reel, { ReelHandle, Triple } from './Reel';
import CoinCelebration from './CoinCelebration';
import JackpotSymbol from './JackpotSymbol';
import IntroCoinShower from './IntroCoinShower';
import { SYMBOLS, SymbolKey, randomSymbol } from './symbols';

const USE_NATIVE = Platform.OS !== 'web';

/* ─── Sounds ─────────────────────────────────────────────────────────────────
 * scrolling.mp3 has ~2.3s of silence before the reel-clicking starts, so we
 * seek past it (SCROLL_START) on spin and pause when the reels settle. */
const SCROLL_SOUND = require('../assets/scrolling.mp3');
const SUCCESS_SOUND = require('../assets/success.mp3');
const JACKPOT_SOUND = require('../assets/jackpot.mp3');
const INTRO_SOUND = require('../assets/MrQ.wav');
const BG_SOUND = require('../assets/bgGrils.mp3');
const SCROLL_START = 2.3; // skip scrolling.mp3's silent slow-start (seconds)
const BG_VOLUME = 0.15; // background music sits low under everything

// MrQ's condensed display font (loaded in App.tsx via expo-font).
const FONT = 'FormulaCondensed-Bold';

type Rect = { x: number; y: number; w: number; h: number };

/* ─── Shell configuration — tweak these to fit the artwork ──────────────────
 * SHELL_ASPECT / SHELL_WIDTH_FRACTION / SHELL_MAX_WIDTH — size of the cabinet.
 * REEL_WINDOW — the reel cutout, as fractions of the shell box.
 * COIN_AREA / SPINS_AREA — where the coin balance and the spins bar sit.
 * Add more areas with <ShellArea rect={{x,y,w,h}}>…</ShellArea>.
 * ───────────────────────────────────────────────────────────────────────── */
const SHELL_ASPECT = 356 / 617;
const SHELL_WIDTH_FRACTION = 0.9;
const SHELL_MAX_WIDTH = 360;
const REEL_WINDOW: Rect = { x: 0.105, y: 0.41, w: 0.79, h: 0.45 }; // white backing (covers the cutout)
const REEL_AREA: Rect = { x: 0.105, y: 0.41, w: 0.79, h: 0.38 }; // the reels, fit above the base panel
const COIN_AREA: Rect = { x: 0.1, y: 0.295, w: 0.8, h: 0.075 };
const SPINS_AREA: Rect = { x: 0.12, y: 0.8, w: 0.76, h: 0.09 };

// Aspect ratios of the imported art (width ÷ height of each viewBox).
const CLOUD_BG_ASPECT = 375 / 518;
const SPIN_BUTTON_ASPECT = 287 / 139;

// Simple economy (easy to tweak).
const SPINS_MAX = 5;

const SKY = '#022ab4';
const WINDOW = '#fbfbfb';
const GOLD = '#fbcb00';
const TRACK = '#0a2272';

const INITIAL: Triple[] = [
  ['coin', 'seven', 'clover'],
  ['gem', 'energy', 'clover'],
  ['bar', 'coin', 'seven'],
];

/* ─── Win logic — scored on the centre row (the payline the arrows point at) ──
 *   3 distinct symbols  → "single"  → 10 coins
 *   2 the same          → "pair"    → 30 coins
 *   3 the same          → "triple"  → 50 coins + jackpot symbol effect
 * A triple is guaranteed at least once in every 5 spins (see spinsSinceTriple).
 * ───────────────────────────────────────────────────────────────────────── */
type Tier = 'single' | 'pair' | 'triple';
const PAYOUT: Record<Tier, number> = { single: 10, pair: 30, triple: 50 };

const otherThan = (...exclude: SymbolKey[]): SymbolKey => {
  let s = randomSymbol();
  while (exclude.includes(s)) s = randomSymbol();
  return s;
};

// A full 3×3 result built from the desired centre row; top/bottom rows are filler.
const gridFromMidRow = (mid: Triple): [Triple, Triple, Triple] =>
  [0, 1, 2].map((i) => [randomSymbol(), mid[i], randomSymbol()] as Triple) as [Triple, Triple, Triple];

function decideOutcome(mustTriple: boolean): { tier: Tier; symbol: SymbolKey; grid: [Triple, Triple, Triple] } {
  let tier: Tier;
  if (mustTriple) tier = 'triple';
  else {
    const r = Math.random();
    tier = r < 0.15 ? 'triple' : r < 0.6 ? 'pair' : 'single';
  }
  if (tier === 'triple') {
    const s = randomSymbol();
    return { tier, symbol: s, grid: gridFromMidRow([s, s, s]) };
  }
  if (tier === 'pair') {
    const s = randomSymbol();
    const t = otherThan(s);
    // keep the matching pair adjacent in the row
    const mid: Triple = Math.random() < 0.5 ? [s, s, t] : [t, s, s];
    return { tier, symbol: s, grid: gridFromMidRow(mid) };
  }
  const a = randomSymbol();
  const b = otherThan(a);
  const c = otherThan(a, b);
  return { tier, symbol: a, grid: gridFromMidRow([a, b, c]) };
}

const pct = (n: number) => `${n * 100}%` as DimensionValue;

// Positions its children into a fractional rectangle of the shell box.
function ShellArea({ rect, style, children }: { rect: Rect; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  return (
    <View style={[{ position: 'absolute', left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }, style]}>
      {children}
    </View>
  );
}

// Very slow looping drift, for parallax depth on background elements.
// flipX mirrors the art (the cloud cut-edges are on the left, so mirror for the right side).
function Drift({ children, ampX = 0, ampY = 0, duration, delay = 0, flipX = false, style }: {
  children: React.ReactNode; ampX?: number; ampY?: number; duration: number; delay?: number; flipX?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay]);
  const transform: any[] = [
    { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-ampX, ampX] }) },
    { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-ampY, ampY] }) },
  ];
  if (flipX) transform.push({ scaleX: -1 });
  return <Animated.View style={[{ pointerEvents: 'none' }, style, { transform }]}>{children}</Animated.View>;
}

// Shows the coins won on the last spin. Empty until a win is revealed, then it
// pops in (scale + fade). Set win to null to hide it (e.g. when the next spin starts).
function WinBadge({ win, size }: { win: number | null; size: number }) {
  const scale = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (win == null) {
      Animated.timing(scale, { toValue: 0, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: USE_NATIVE }).start();
    } else {
      setShown(win);
      scale.setValue(0);
      Animated.timing(scale, { toValue: 1, duration: 230, easing: Easing.out(Easing.back(3.4)), useNativeDriver: USE_NATIVE }).start();
    }
  }, [win, scale]);
  return (
    <Animated.View style={{ flexDirection: 'row', alignItems: 'center', transform: [{ scale }], opacity: scale }}>
      <Image source={SYMBOLS.coin} style={{ width: size * 1.4, height: size * 1.4, marginRight: size * 0.18 }} resizeMode="contain" />
      <Text style={{ color: '#fff', fontFamily: FONT, fontSize: size, letterSpacing: 1 }}>
        {shown != null ? shown.toLocaleString() : ''}
      </Text>
    </Animated.View>
  );
}

// Top-bar coin balance with a count-up + pulse when it increases.
function BalanceCounter({ value, fontSize }: { value: number; fontSize: number }) {
  const anim = useRef(new Animated.Value(value)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState(value);
  const first = useRef(true);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    if (!first.current) {
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.16, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE }),
        Animated.timing(pulse, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE }),
      ]).start();
    }
    first.current = false;
    return () => anim.removeListener(id);
  }, [value, anim, pulse]);
  return (
    <Animated.Text style={{ color: '#022ab4', fontFamily: FONT, fontSize, letterSpacing: 1, transform: [{ scale: pulse }] }}>
      {shown.toLocaleString()}
    </Animated.Text>
  );
}

// Top bar: gold coin-balance pill (left) + avatar (right).
function TopBar({ total }: { total: number }) {
  const coin = 58;
  const pillH = 44;
  return (
    <View style={styles.topBar}>
      <View style={{ height: coin, justifyContent: 'center' }}>
        <View
          style={{
            height: pillH,
            // Left edge is square and pulled in behind the coin so the coin
            // fully covers it — only the right end is rounded.
            marginLeft: coin * 0.5,
            borderTopRightRadius: pillH / 2,
            borderBottomRightRadius: pillH / 2,
            backgroundColor: GOLD,
            paddingLeft: coin * 0.64,
            paddingRight: 20,
            justifyContent: 'center',
          }}
        >
          <BalanceCounter value={total} fontSize={pillH * 0.5} />
        </View>
        <Image source={SYMBOLS.coin} style={{ position: 'absolute', left: 0, top: 0, width: coin, height: coin, zIndex: 2 }} resizeMode="contain" />
      </View>
      <CloseIcon width={22} height={22} />
    </View>
  );
}

export default function SlotMachine() {
  const { width: rawWidth, height } = useWindowDimensions();
  // On web the app is constrained to 430px — cap width so clouds/sunburst
  // don't scale with the browser window.
  const width = Platform.OS === 'web' ? Math.min(rawWidth, 390) : rawWidth;

  const shellW = Math.min(width * SHELL_WIDTH_FRACTION, SHELL_MAX_WIDTH);
  const shellH = shellW / SHELL_ASPECT;

  const cell = (REEL_AREA.h * shellH) / 3;
  const reelW = (REEL_AREA.w * shellW) / 3;

  // Cloud-bank slightly wider than the screen so its drift never reveals sky.
  const bgW = width * 1.18;
  const bgH = bgW / CLOUD_BG_ASPECT;

  const reels = [useRef<ReelHandle>(null), useRef<ReelHandle>(null), useRef<ReelHandle>(null)];
  const [spinning, setSpinning] = useState(false);
  const [coinTrigger, setCoinTrigger] = useState(0);
  const [coinCount, setCoinCount] = useState(PAYOUT.single);
  const [win, setWin] = useState<number | null>(null);
  const [total, setTotal] = useState(12384);
  const [spinsLeft, setSpinsLeft] = useState(SPINS_MAX);
  // 3-in-a-row payoff: which symbol to blow up, and a trigger to re-fire it.
  const [jackpotTrigger, setJackpotTrigger] = useState(0);
  const [jackpotSymbol, setJackpotSymbol] = useState<SymbolKey | null>(null);
  // Spins since the last triple — force one once it hits 4 (≥1 triple per 5 spins).
  const spinsSinceTriple = useRef(0);
  // Synchronous re-entry guard so a rapid double-tap can't start two spins.
  const busy = useRef(false);

  // Audio players: reel scroll, win chime, jackpot, intro jingle, bg music.
  const scroll = useAudioPlayer(SCROLL_SOUND);
  const success = useAudioPlayer(SUCCESS_SOUND);
  const jackpot = useAudioPlayer(JACKPOT_SOUND);
  const intro = useAudioPlayer(INTRO_SOUND);
  const bg = useAudioPlayer(BG_SOUND);

  // Animated SPINS-LEFT progress so the bar slides instead of snapping.
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: spinsLeft / SPINS_MAX,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [spinsLeft, progress]);

  // Page-load reveal: scene starts hidden (just the blue base + coin shower on
  // top), then fades in as the coins clear so the machine "appears".
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 900,
      delay: 1100, // stay hidden while the shower covers the screen, then emerge as it clears
      easing: Easing.out(Easing.quad),
      useNativeDriver: USE_NATIVE,
    }).start();
  }, [reveal]);

  // Sunburst background — slow continuous rotation.
  const sunRotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sunRotate, {
        toValue: 1,
        duration: 24000, // one full revolution every 24 seconds
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [sunRotate]);

  // Play the MrQ intro on load, then loop the background music quietly under it.
  // Web blocks audio until a user gesture, so there we kick it off on first tap.
  useEffect(() => {
    let bgStarted = false;
    const startBg = () => {
      if (bgStarted) return;
      bgStarted = true;
      try { bg.loop = true; bg.volume = BG_VOLUME; bg.seekTo(0); bg.play(); } catch {}
    };
    const sub = intro.addListener('playbackStatusUpdate', (s: any) => {
      if (s && s.didJustFinish) startBg();
    });
    let started = false;
    const startMusic = () => {
      if (started) return;
      started = true;
      try { intro.volume = 1; intro.seekTo(0); intro.play(); } catch {}
      setTimeout(startBg, 3000); // fallback if the finish event doesn't fire
    };
    let cleanupGesture: (() => void) | undefined;
    if (Platform.OS === 'web') {
      const onFirst = () => startMusic();
      window.addEventListener('pointerdown', onFirst, { once: true });
      cleanupGesture = () => window.removeEventListener('pointerdown', onFirst);
    } else {
      startMusic();
    }
    return () => {
      if (sub && sub.remove) sub.remove();
      if (cleanupGesture) cleanupGesture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const machineRef = useRef<View>(null);
  const [originY, setOriginY] = useState(0);
  const onMachineLayout = (_e: LayoutChangeEvent) => {
    machineRef.current?.measureInWindow((_x, y, _w, h) =>
      setOriginY(y + h * (REEL_WINDOW.y + REEL_WINDOW.h / 2))
    );
  };

  const onSpin = async () => {
    if (busy.current) return; // synchronous guard (state updates lag within an event burst)
    busy.current = true;
    setSpinning(true);
    setWin(null); // hide the previous win while spinning
    setSpinsLeft((s) => (s <= 1 ? SPINS_MAX : s - 1)); // auto-refill when the last spin is used

    // Reel-scroll sound: skip the silent slow-start and run while the reels move.
    try { scroll.seekTo(SCROLL_START); scroll.play(); } catch {}

    // Decide the result up front (forcing a triple if 4 spins have passed without one).
    const mustTriple = spinsSinceTriple.current >= 4;
    const outcome = decideOutcome(mustTriple);
    spinsSinceTriple.current = outcome.tier === 'triple' ? 0 : spinsSinceTriple.current + 1;

    const durations = [1200, 1650, 2100];
    await Promise.all(
      reels.map((r, i) => r.current?.spin(outcome.grid[i], durations[i]) ?? Promise.resolve())
    );

    // Reels stopped → stop the scroll sound.
    try { scroll.pause(); } catch {}

    const amount = PAYOUT[outcome.tier];
    setWin(amount); // reveal the win (pops in) above the reels
    setTotal((t) => t + amount); // add it to the top-bar balance (counts up)
    setCoinCount(amount); // splash exactly that many coins (10 / 30 / 50)
    setCoinTrigger((t) => t + 1); // coin celebration
    try { success.seekTo(0); success.play(); } catch {} // win chime as the coins fly
    if (outcome.tier === 'triple') {
      // HUGE celebration: jackpot chime + blow up the winning symbol from the middle.
      try { jackpot.seekTo(0); jackpot.play(); } catch {}
      setJackpotSymbol(outcome.symbol);
      setJackpotTrigger((t) => t + 1);
    }
    setSpinning(false);
    busy.current = false;
  };

  return (
    <View style={[styles.root, { backgroundColor: SKY }]}>
      {/* The whole scene fades in as the intro coin-shower clears. */}
      <Animated.View style={{ flex: 1, opacity: reveal }}>
      {/* sunburst rays — slowly rotating, behind clouds + machine */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.View style={[{
          width: Math.sqrt(width * width + height * height) * 1.1,
          height: Math.sqrt(width * width + height * height) * 1.1,
          opacity: 0.18,
          transform: [{ rotate: sunRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }, Platform.OS === 'web' && { filter: 'brightness(1000)' } as any]}>
          <Sunburst width="100%" height="100%" />
        </Animated.View>
      </View>

      {/* cloud-bank "ground" (the pale bg) */}
      <Drift duration={46000} ampX={width * 0.035} style={{ position: 'absolute', bottom: -90, left: (width - bgW) / 2, width: bgW, height: bgH }}>
        <CloudBg width={bgW} height={bgH} />
      </Drift>

      <View style={styles.content}>
        {/* the machine = the shell cabinet; reels show through its cutout */}
        <View ref={machineRef} onLayout={onMachineLayout} style={{ width: shellW, height: shellH }}>
          {/* white backing fills the cutout (incl. behind the base panel) */}
          <ShellArea rect={REEL_WINDOW} style={{ backgroundColor: WINDOW }} />
          {/* reels sit in the visible area above the base panel */}
          <ShellArea rect={REEL_AREA} style={{ overflow: 'hidden', flexDirection: 'row' }}>
            {reels.map((r, i) => (
              <Reel key={i} ref={r} cell={cell} width={reelW} initial={INITIAL[i]} />
            ))}
          </ShellArea>

          {/* the whole cabinet artwork ON TOP (its cutout reveals the reels) */}
          <View style={{ position: 'absolute', left: 0, top: 0, width: shellW, height: shellH, pointerEvents: 'none' }}>
            <SlotShell width={shellW} height={shellH} />
          </View>

          {/* per-spin win: empty until the spin lands, then pops in as the coins fly */}
          <ShellArea rect={COIN_AREA} style={{ alignItems: 'center', justifyContent: 'center' }}>
            <WinBadge win={win} size={shellW * 0.085} />
          </ShellArea>

          {/* spins left + progress bar, on the base panel */}
          <ShellArea rect={SPINS_AREA} style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontFamily: FONT, fontSize: shellW * 0.072, letterSpacing: 1.5, marginBottom: shellH * 0.014 }}>
              {spinsLeft}  SPINS LEFT
            </Text>
            <View style={{ width: '90%', height: shellH * 0.03, borderRadius: 999, backgroundColor: TRACK, overflow: 'hidden' }}>
              <Animated.View style={{ width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: '100%', borderRadius: 999, backgroundColor: GOLD, overflow: 'hidden' }}>
                {/* Duolingo-style glossy highlight along the top of the fill */}
                <View
                  style={{
                    position: 'absolute',
                    top: '15%',
                    left: shellH * 0.013,
                    right: shellH * 0.013,
                    height: '30%',
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.5)',
                  }}
                />
              </Animated.View>
            </View>
          </ShellArea>
        </View>

        {/* SPIN button (your SVG); sits higher, overlapping the base panel */}
        <View style={{ marginTop: -shellH * 0.09 }}>
          <SpinButton width={shellW * 0.66} onPress={onSpin} disabled={spinning} />
        </View>
      </View>

      <CoinCelebration trigger={coinTrigger} originY={originY} count={coinCount} />
      <JackpotSymbol
        trigger={jackpotTrigger}
        symbol={jackpotSymbol}
        size={shellW * 0.46}
        centerX={width / 2}
        centerY={originY}
      />
      <TopBar total={total} />
      </Animated.View>

      {/* page-load welcome: a full-screen coin shower that clears to reveal the machine */}
      <IntroCoinShower />
    </View>
  );
}

function SpinButton({ width, onPress, disabled }: { width: number; onPress: () => void; disabled?: boolean }) {
  const height = width / SPIN_BUTTON_ASPECT;
  const press = useRef(new Animated.Value(0)).current;
  const to = (v: number) =>
    Animated.timing(press, { toValue: v, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE }).start();
  // Only the pink keycap travels down (the grey pedestal stays put).
  const keyDrop = press.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.075] });
  return (
    <Pressable onPress={onPress} onPressIn={() => to(1)} onPressOut={() => to(0)} disabled={disabled}>
      <View style={{ width, height }}>
        <View style={{ position: 'absolute', left: 0, top: 0 }}>
          <SpinButtonBase width={width} height={height} />
        </View>
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateY: keyDrop }] }}>
          <SpinButtonKey width={width} height={height} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, alignItems: 'center', paddingTop: 44 },
  topBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
});
