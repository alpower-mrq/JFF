# MrQ Slot Machine

A very simple React Native (Expo) slot machine, built to match the
["Just for Fun Future Vision" Figma](https://www.figma.com/design/HdRJXCCVzfE4mVVnWrZDSh/Just-for-Fun-Future-Vision?node-id=4-98).

Tap **SPIN** → the 9 symbols spin and tick to a stop (left reel first, then
middle, then right) → a coin celebration bursts out. That's it, for now.

## Run it

```bash
npm install          # first time only

npm run ios          # iOS simulator (or press i after `npm start`)
npm run android      # Android emulator / device via Expo Go
npm run web          # quick preview in the browser
```

`npm start` opens the Expo dev menu so you can pick a target / scan the QR code
with Expo Go.

## Deploy to the web (Vercel)

One codebase — the same app exports to a static single-page web app:

```bash
npm run build:web     # runs `expo export -p web`, outputs to dist/
npx serve -s dist     # optional: preview the production build locally
```

`vercel.json` is already set up (build command `expo export -p web`, output
`dist`, SPA rewrites + clean URLs), so deploying needs no manual config:

- **CLI:** run `vercel` (preview) or `vercel --prod` from the project root.
- **Git:** import the repo in the Vercel dashboard — it reads `vercel.json`
  automatically (framework preset: Other).

`app.json` sets `web.bundler: "metro"` and `web.output: "single"`.

## How it works

- **`App.tsx`** – mounts the single screen.
- **`src/SlotMachine.tsx`** – the screen: sky + clouds, the machine cabinet and
  the SPIN button. The cabinet is **`assets/slot_shell.svg`**, imported whole as a
  component (`import SlotShell from '../assets/slot_shell.svg'`); the three reels
  render on a white panel **behind** it and show through the shell's transparent
  reel-window cutout. On SPIN it picks a random result per reel, spins them with
  staggered durations, then fires the coin celebration once all three settle.
- **`src/Reel.tsx`** – one reel column. Scrolls a strip of symbols, decelerates,
  overshoots slightly and ticks into place, then seamlessly normalises for the
  next spin.
- **`src/CoinCelebration.tsx`** – a burst of coins that erupts from the reel
  window, arcs out and falls away.
- **`src/symbols.ts`** – the 12 symbol images, sliced from the Figma sprite
  sheet (`assets/symbols/`).
- **`src/svgAssets.ts`** + **`src/Clouds.tsx`** – the clouds, rendered as vectors
  via `react-native-svg`.

## Customizing the cabinet

The cabinet is a single SVG — **`assets/slot_shell.svg`**. Edit or replace that
one file and the app updates automatically (Metro re-bundles it via
`react-native-svg-transformer`; see `metro.config.js`). No codegen / slicing step.

Knobs at the top of `src/SlotMachine.tsx`:

- `SHELL_WIDTH_FRACTION` / `SHELL_MAX_WIDTH` — how big the cabinet is on screen.
- `SHELL_ASPECT` — the art's width ÷ height (currently `359 / 617`). Update this
  if you swap in art with different proportions so it scales without distortion.
- `REEL_WINDOW` — the reel cutout, as fractions `{ x, y, w, h }` of the cabinet box.

To drop another component into an empty area of the cabinet, position it with the
same fractional helper (it works in front of or behind the shell depending on
order):

```tsx
<ShellArea rect={{ x: 0.3, y: 0.05, w: 0.4, h: 0.12 }}>
  <YourComponent />
</ShellArea>
```

## Notes

- Every spin lands on a random result and always ends with the coin
  celebration — there's no win/lose logic yet (kept deliberately simple).
- Animations use the native driver on device for smoothness; on web they fall
  back to the JS driver automatically.
