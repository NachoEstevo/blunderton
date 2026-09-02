# BLUNDERTON

*Tiny games. Terrible decisions.*

A frantic web arcade of 15 original microgames set in Blunderton, a town whose adorable residents have a special talent for completely avoidable accidents. Three lives, rising speed, a best score to beat, and a collection of residents and accidents to discover.

Built with **TypeScript + Phaser 3 + Vite**. No backend, no accounts, no external assets: every graphic is drawn from primitives and every sound is synthesized with the Web Audio API. Progress is kept in `localStorage`.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-checks, then builds to dist/
npm run preview  # serves the production build
```

## Play it

- **Mouse / trackpad / touch / keyboard** all work. Every microgame has a touch equivalent for any keyboard control.
- Read the word, look at the screen, act. You have a few seconds.
- Three mistakes and it's Game Over. Retry is one tap away.
- On phones, play in landscape (the game asks you to rotate).

## The 15 microgames

| Game | Instruction | Mechanic |
| --- | --- | --- |
| Cactus Balloon | FLOAT! | steer a balloon through a room of cacti |
| Vending Machine | SHAKE! | rapid tap to free a snack before the machine topples |
| Umbrella Emergency | CRANK! | alternate left/right to open an umbrella before a tiny 2-ton piano lands |
| Runaway Cart | BRAKE! | hold/release to keep the brake in the sweet spot |
| Fan Problem | PULL! | drag a scarf away from an industrial fan |
| Soup Disaster | BALANCE! | left/right torque to keep a pot of soup level |
| Bad Haircut | STOP! | stop the needle in the safe zone (fake zones at high difficulty) |
| Hungry Plant | FEED IT! | drag only food into a carnivorous houseplant |
| Memory Lock | REPEAT! | memorize and replay a 3 to 5 symbol sequence |
| Toast Launcher | CATCH! | click flying toast, not the bricks |
| Office Chair Rocket | STEER! | lane switching down a hallway |
| Cake Candles | BLOW OUT! | tap the lit candles, some relight |
| Tiny Bridge | STEADY! | keep balance with inertia while carrying a bathtub |
| Wrong Buttons | PRESS IT! | press the indicated button, ignore the tempting ones |
| Escape the Roomba | RUN! | outrun a small vacuum until its battery dies |

Each game has its own difficulty curve (time, speed, count, decoys) driven by a global director that tracks games cleared and time survived. Returning games come back meaner.

## Structure

```
src/
  main.ts                 Phaser config, scenes, debug entry
  core/                   Director (run state, selection, score), Difficulty, Audio (synth), Save, Unlocks, GameInput
  entities/               Critter (procedural character renderer), Characters (10 residents), Props (shared drawing)
  microgames/             Microgame base class, registry, games/ (one file per microgame)
  scenes/                 Title, Menu, HowTo, Collection, Play, GameOver
  ui/                     Text, Button, Hud, TimerBar, Transition
```

Adding a microgame: create a class extending `Microgame` in `src/microgames/games/`, export its `meta`, and register it in `registry.ts`. The director, HUD, timer, transitions and unlock tracking pick it up automatically.

## Debug

- `?debugGame=fan` plays a single microgame on repeat.
- `?debugGame=all` runs every microgame in registry order.
- `?debugGame=cake,roomba` cycles through a custom list.

In debug mode a `window.__blunderton` handle exposes the scene, current game and director for automated testing.
