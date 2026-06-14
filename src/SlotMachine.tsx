import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  DimensionValue,
  Easing,
  Image,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import SlotShell from '../assets/slot_shell.svg';
import CloudBg from '../assets/cloud_bg.svg';
import SpinButtonBase from '../assets/spin_button_base.svg';
import SpinButtonKey from '../assets/spin_button_key.svg';
const SUNBURST = require('../assets/sunburst.png');
import CloseIcon from '../assets/close.svg';
import LetsGoIcon from '../assets/letsgo.svg';
import BottomClouds from '../assets/bottom-bg-clouds.svg';
import CloudTunnel from '../assets/clouds_topbottom.svg';
import { useAudioPlayer } from 'expo-audio';
import Reel, { ReelHandle, Triple } from './Reel';
import CoinCelebration from './CoinCelebration';
import JackpotSymbol from './JackpotSymbol';
import IntroCoinShower from './IntroCoinShower';
import { SYMBOLS, SymbolKey, randomSymbol } from './symbols';

const USE_NATIVE = Platform.OS !== 'web';

const SCROLL_SOUND = require('../assets/scrolling.mp3');
const SUCCESS_SOUND = require('../assets/success.mp3');
const JACKPOT_SOUND = require('../assets/jackpot.mp3');
const INTRO_SOUND = require('../assets/MrQ.m4a');
const BG_SOUND = require('../assets/bgGrils.m4a');
const SCROLL_START = 2.3;
const BG_VOLUME = 0.15;

const FONT = 'FormulaCondensed-Bold';
const LETSGO_ASPECT = 449 / 348;

type Rect = { x: number; y: number; w: number; h: number };

const SHELL_ASPECT = 356 / 617;
const SHELL_WIDTH_FRACTION = 0.82;
const SHELL_MAX_WIDTH = 330;
const REEL_WINDOW: Rect = { x: 0.105, y: 0.41, w: 0.79, h: 0.45 };
const REEL_AREA: Rect   = { x: 0.105, y: 0.41, w: 0.79, h: 0.38 };
const COIN_AREA: Rect   = { x: 0.1,   y: 0.295, w: 0.8, h: 0.075 };
const SPINS_AREA: Rect  = { x: 0.12,  y: 0.8,   w: 0.76, h: 0.09 };

const CLOUD_BG_ASPECT = 375 / 518;
const SPIN_BUTTON_ASPECT = 287 / 139;
const SPINS_MAX = 5;

const SKY   = '#022ab4';
const WINDOW = '#fbfbfb';
const GOLD  = '#fbcb00';
const TRACK = '#0a2272';

const INITIAL: Triple[] = [
  ['coin', 'seven', 'clover'],
  ['gem',  'energy', 'clover'],
  ['bar',  'coin',  'seven'],
];

type Tier = 'single' | 'pair' | 'triple';
const PAYOUT: Record<Tier, number> = { single: 10, pair: 30, triple: 50 };

const otherThan = (...exclude: SymbolKey[]): SymbolKey => {
  let s = randomSymbol();
  while (exclude.includes(s)) s = randomSymbol();
  return s;
};

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
    const mid: Triple = Math.random() < 0.5 ? [s, s, t] : [t, s, s];
    return { tier, symbol: s, grid: gridFromMidRow(mid) };
  }
  const a = randomSymbol();
  const b = otherThan(a);
  const c = otherThan(a, b);
  return { tier, symbol: a, grid: gridFromMidRow([a, b, c]) };
}

const pct = (n: number) => `${n * 100}%` as DimensionValue;

function ShellArea({ rect, style, children }: { rect: Rect; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  return (
    <View style={[{ position: 'absolute', left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }, style]}>
      {children}
    </View>
  );
}

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

const WinBadge = React.memo(function WinBadge({ win, size }: { win: number | null; size: number }) {
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
});

const BalanceCounter = React.memo(function BalanceCounter({ value, fontSize }: { value: number; fontSize: number }) {
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
        Animated.timing(pulse, { toValue: 1,    duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE }),
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
});

const TopBar = React.memo(function TopBar({ total, onClose }: { total: number; onClose: () => void }) {
  const coin = 58;
  const pillH = 44;
  return (
    <View style={styles.topBar}>
      <View style={{ height: coin, justifyContent: 'center' }}>
        <View style={{
          height: pillH,
          marginLeft: coin * 0.5,
          borderTopRightRadius: pillH / 2,
          borderBottomRightRadius: pillH / 2,
          backgroundColor: GOLD,
          paddingLeft: coin * 0.64,
          paddingRight: 20,
          justifyContent: 'center',
        }}>
          <BalanceCounter value={total} fontSize={pillH * 0.5} />
        </View>
        <Image source={SYMBOLS.coin} style={{ position: 'absolute', left: 0, top: 0, width: coin, height: coin, zIndex: 2 }} resizeMode="contain" />
      </View>
      <Pressable onPress={onClose} hitSlop={12}>
        <CloseIcon width={22} height={22} />
      </Pressable>
    </View>
  );
});

export default function SlotMachine() {
  const { width: rawWidth, height } = useWindowDimensions();
  const width = Platform.OS === 'web' ? Math.min(rawWidth, 390) : rawWidth;

  const shellW = Math.min(width * SHELL_WIDTH_FRACTION, SHELL_MAX_WIDTH);
  const shellH = shellW / SHELL_ASPECT;
  const cell  = (REEL_AREA.h * shellH) / 3;
  const reelW = (REEL_AREA.w * shellW) / 3;
  const bgW   = width * 1.18;
  const bgH   = bgW / CLOUD_BG_ASPECT;

  const reels = [useRef<ReelHandle>(null), useRef<ReelHandle>(null), useRef<ReelHandle>(null)];
  const [spinning, setSpinning]       = useState(false);
  const [coinTrigger, setCoinTrigger] = useState(0);
  const [coinCount, setCoinCount]     = useState(PAYOUT.single);
  const [win, setWin]                 = useState<number | null>(null);
  const [total, setTotal]             = useState(12384);
  const [spinsLeft, setSpinsLeft]     = useState(SPINS_MAX);
  const [jackpotTrigger, setJackpotTrigger] = useState(0);
  const [jackpotSymbol, setJackpotSymbol]   = useState<SymbolKey | null>(null);
  const spinsSinceTriple = useRef(0);
  const busy = useRef(false);

  // Two-page navigation: 0 = slots, 1 = games.
  const currentPageRef = useRef<0 | 1>(0);
  const spinsLeftRef   = useRef(SPINS_MAX);
  const pageTranslate  = useRef(new Animated.Value(0)).current;

  // LET'S GO! overlay — bounces in when the last spin is used, then the page shoots down.
  const [showLetsgo, setShowLetsgo]   = useState(false);
  const letsgoY       = useRef(new Animated.Value(200)).current;
  const letsgoOpacity = useRef(new Animated.Value(0)).current;

  const scroll  = useAudioPlayer(SCROLL_SOUND);
  const success = useAudioPlayer(SUCCESS_SOUND);
  const jackpot = useAudioPlayer(JACKPOT_SOUND);
  const intro   = useAudioPlayer(INTRO_SOUND);
  const bg      = useAudioPlayer(BG_SOUND);

  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: spinsLeft / SPINS_MAX,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [spinsLeft, progress]);

  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 900,
      delay: 1100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: USE_NATIVE,
    }).start();
  }, [reveal]);

  const sunRotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sunRotate, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [sunRotate]);

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
      setTimeout(startBg, 3000);
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

  // Keep height available inside the PanResponder (created once via useRef).
  const heightRef = useRef(height);
  heightRef.current = height;

  const machineRef = useRef<View>(null);
  const [originY, setOriginY] = useState(0);
  const onMachineLayout = useCallback((_e: LayoutChangeEvent) => {
    machineRef.current?.measureInWindow((_x, y, _w, h) =>
      setOriginY(y + h * (REEL_WINDOW.y + REEL_WINDOW.h / 2))
    );
  }, []);

  // ── Page navigation ───────────────────────────────────────────────────────

  const navigateToGames = () => {
    currentPageRef.current = 1;
    Animated.timing(pageTranslate, {
      toValue: -height * 3,
      duration: 280,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: USE_NATIVE,
    }).start();
  };

  const navigateToSlots = () => {
    currentPageRef.current = 0;
    Animated.timing(pageTranslate, {
      toValue: 0,
      duration: 280,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: USE_NATIVE,
    }).start();
  };

  const handleClose = useCallback(() => {
    if (Platform.OS === 'web') {
      // @ts-ignore
      window.location.reload();
    } else {
      setSpinsLeft(SPINS_MAX);
      spinsLeftRef.current = SPINS_MAX;
      setTotal(12384);
      setWin(null);
      setSpinning(false);
      setCoinTrigger(0);
      setJackpotTrigger(0);
      setJackpotSymbol(null);
      setShowLetsgo(false);
      spinsSinceTriple.current = 0;
      busy.current = false;
      currentPageRef.current = 0;
      pageTranslate.setValue(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bounce in the LET'S GO graphic, then shoot down to the games world.
  const triggerLetsGo = () => {
    setShowLetsgo(true);
    letsgoY.setValue(220);
    letsgoOpacity.setValue(0);
    Animated.sequence([
      // Bounce in from below with slight overshoot.
      Animated.parallel([
        Animated.spring(letsgoY, { toValue: 0, tension: 80, friction: 9, useNativeDriver: USE_NATIVE }),
        Animated.timing(letsgoOpacity, { toValue: 1, duration: 180, useNativeDriver: USE_NATIVE }),
      ]),
      // Hold so the player reads it.
      Animated.delay(750),
      // Shoot down + fade simultaneously.
      Animated.parallel([
        Animated.timing(pageTranslate, {
          toValue: -height * 3,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(letsgoOpacity, { toValue: 0, duration: 180, useNativeDriver: USE_NATIVE }),
      ]),
    ]).start(() => {
      setShowLetsgo(false);
      currentPageRef.current = 1;
    });
  };

  // Swipe down on games → back to slots; swipe up on slots → games (any time).
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dy) > 14 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
    onPanResponderGrant: () => pageTranslate.stopAnimation(),
    onPanResponderMove: (_, gs) => {
      const h = heightRef.current;
      const base = currentPageRef.current === 0 ? 0 : -(h * 3);
      pageTranslate.setValue(base + gs.dy * 0.25);
    },
    onPanResponderRelease: (_, gs) => {
      const h = heightRef.current;
      if (currentPageRef.current === 1 && gs.dy > 60) {
        navigateToSlots();
      } else if (currentPageRef.current === 0 && gs.dy < -60) {
        navigateToGames();
      } else {
        const base = currentPageRef.current === 0 ? 0 : -(h * 3);
        Animated.spring(pageTranslate, {
          toValue: base,
          tension: 200,
          friction: 22,
          useNativeDriver: USE_NATIVE,
        }).start();
      }
    },
  })).current;

  // ── Spin ─────────────────────────────────────────────────────────────────

  const onSpin = async () => {
    if (busy.current || spinsLeft === 0) return;
    busy.current = true;
    setSpinning(true);
    setWin(null);

    const newSpins = spinsLeft - 1;
    setSpinsLeft(newSpins);
    spinsLeftRef.current = newSpins;

    try { scroll.seekTo(SCROLL_START); scroll.play(); } catch {}

    const mustTriple = spinsSinceTriple.current >= 4;
    const outcome = decideOutcome(mustTriple);
    spinsSinceTriple.current = outcome.tier === 'triple' ? 0 : spinsSinceTriple.current + 1;

    const durations = [1200, 1650, 2100];
    await Promise.all(
      reels.map((r, i) => r.current?.spin(outcome.grid[i], durations[i]) ?? Promise.resolve())
    );

    try { scroll.pause(); } catch {}

    const amount = PAYOUT[outcome.tier];
    setWin(amount);
    setTotal((t) => t + amount);
    setCoinCount(amount);
    setCoinTrigger((t) => t + 1);
    try { success.seekTo(0); success.play(); } catch {}
    if (outcome.tier === 'triple') {
      try { jackpot.seekTo(0); jackpot.play(); } catch {}
      setJackpotSymbol(outcome.symbol);
      setJackpotTrigger((t) => t + 1);
    }
    setSpinning(false);
    busy.current = false;

    // Last spin used → bounce in LET'S GO then shoot to games.
    if (newSpins === 0) triggerLetsGo();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const letsgoW = shellW * 0.85;
  const letsgoH = letsgoW / LETSGO_ASPECT;

  return (
    <View style={[styles.root, { backgroundColor: SKY }]} {...panResponder.panHandlers}>

      {/* ── Two-page world: slots → gap → games ── */}
      <Animated.View style={{ width: '100%', height: height * 4, transform: [{ translateY: pageTranslate }] }}>

        {/* ── Page 0: Slot machine ── */}
        <View style={{ height }}>
          <Animated.View style={{ flex: 1, opacity: reveal }}>

            {/* Rotating sunburst — plain PNG, no SVG parsing overhead */}
            <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', alignItems: 'center', justifyContent: 'center' }]}>
              <Animated.View style={[{
                width: Math.sqrt(width * width + height * height) * 1.1,
                height: Math.sqrt(width * width + height * height) * 1.1,
                opacity: 0.10,
                transform: [{ rotate: sunRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
              }, Platform.OS === 'web' && { filter: 'brightness(1000)' } as any]}>
                <Image source={SUNBURST} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </Animated.View>
            </View>

            {/* Cloud bank */}
            <Drift duration={46000} ampX={width * 0.035} style={{ position: 'absolute', bottom: -90, left: (width - bgW) / 2, width: bgW, height: bgH }}>
              <CloudBg width={bgW} height={bgH} />
            </Drift>

            <View style={styles.content}>
              <View ref={machineRef} onLayout={onMachineLayout} style={{ width: shellW, height: shellH }}>
                <ShellArea rect={REEL_WINDOW} style={{ backgroundColor: WINDOW }} />
                <ShellArea rect={REEL_AREA} style={{ overflow: 'hidden', flexDirection: 'row' }}>
                  {reels.map((r, i) => (
                    <Reel key={i} ref={r} cell={cell} width={reelW} initial={INITIAL[i]} />
                  ))}
                </ShellArea>
                <View style={{ position: 'absolute', left: 0, top: 0, width: shellW, height: shellH, pointerEvents: 'none' }}>
                  <SlotShell width={shellW} height={shellH} />
                </View>
                <ShellArea rect={COIN_AREA} style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <WinBadge win={win} size={shellW * 0.085} />
                </ShellArea>
                <ShellArea rect={SPINS_AREA} style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontFamily: FONT, fontSize: shellW * 0.072, letterSpacing: 1.5, marginBottom: shellH * 0.014 }}>
                    {spinsLeft}  SPINS LEFT
                  </Text>
                  <View style={{ width: '90%', height: shellH * 0.03, borderRadius: 999, backgroundColor: TRACK, overflow: 'hidden' }}>
                    <Animated.View style={{ width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: '100%', borderRadius: 999, backgroundColor: GOLD, overflow: 'hidden' }}>
                      <View style={{ position: 'absolute', top: '15%', left: shellH * 0.013, right: shellH * 0.013, height: '30%', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.5)' }} />
                    </Animated.View>
                  </View>
                </ShellArea>
              </View>

              {/* SPIN button — hidden when out of spins */}
              {spinsLeft > 0 && (
                <View style={{ marginTop: -shellH * 0.09 }}>
                  <SpinButton width={shellW * 0.66} onPress={onSpin} disabled={spinning} />
                </View>
              )}
            </View>

            <CoinCelebration trigger={coinTrigger} originY={originY} count={coinCount} />
            <JackpotSymbol trigger={jackpotTrigger} symbol={jackpotSymbol} size={shellW * 0.46} centerX={width / 2} centerY={originY} />
          </Animated.View>

          {/* LET'S GO! — bounces in over the machine on the last spin */}
          {showLetsgo && (
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }]}>
              <Animated.View style={{ opacity: letsgoOpacity, transform: [{ translateY: letsgoY }] }}>
                <LetsGoIcon width={letsgoW} height={letsgoH} />
              </Animated.View>
            </View>
          )}
        </View>

        {/* Gap — cloud tunnel, doubled height for travel distance */}
        <View style={{ height: height * 2, overflow: 'hidden' }}>
          <CloudTunnel width={width} height={height * 2} />
        </View>

        {/* ── Page 1: Q Arcade ── */}
        <View style={{ height, backgroundColor: SKY }}>
          {/* Clouds first so game tiles render on top */}
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', pointerEvents: 'none' }]}>
            <BottomClouds width={width} height={width / (375 / 183)} />
          </View>
          <GamesPage shellW={shellW} width={width} />
        </View>

      </Animated.View>

      {/* TopBar floats above both pages */}
      <TopBar total={total} onClose={handleClose} />

      {/* Intro coin shower */}
      <IntroCoinShower />
    </View>
  );
}

const FEATURED_GAME = require('../assets/game37.png');
const WORLD_IMG = require('../assets/world_img.png');

function GamesPage({ shellW, width }: { shellW: number; width: number }) {
  const featW = width * 0.82;
  const featH = featW;
  // world_img is 375×879 — preserve aspect ratio at full width
  const worldH = width * (879 / 375);

  return (
    <View style={{ flex: 1, paddingTop: 70 }}>
      <Text style={{
        color: '#fff', fontFamily: FONT, fontSize: shellW * 0.175,
        letterSpacing: 4, textAlign: 'center', marginBottom: 20,
      }}>
        Q ARCADE
      </Text>

      {/* Featured tile */}
      <Image
        source={FEATURED_GAME}
        style={{ width: featW, height: featH, alignSelf: 'center', borderRadius: 22 }}
        resizeMode="cover"
      />

      {/* World image — sits over the bottom clouds */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Image
          source={WORLD_IMG}
          style={{ width, height: worldH }}
          resizeMode="cover"
        />
      </View>
    </View>
  );
}

const SpinButton = React.memo(function SpinButton({ width, onPress, disabled }: { width: number; onPress: () => void; disabled?: boolean }) {
  const height = width / SPIN_BUTTON_ASPECT;
  const press = useRef(new Animated.Value(0)).current;
  const to = (v: number) =>
    Animated.timing(press, { toValue: v, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE }).start();
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
});

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
