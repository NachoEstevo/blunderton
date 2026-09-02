import type { GameContext, Microgame, MicrogameHost, MicrogameMeta } from './Microgame';
import { CactusBalloon, CactusMeta } from './games/Cactus';
import { VendingMachine, VendingMeta } from './games/Vending';
import { UmbrellaEmergency, UmbrellaMeta } from './games/Umbrella';
import { RunawayCart, CartMeta } from './games/Cart';
import { FanProblem, FanMeta } from './games/Fan';
import { SoupDisaster, SoupMeta } from './games/Soup';
import { BadHaircut, HaircutMeta } from './games/Haircut';
import { HungryPlant, PlantMeta } from './games/Plant';
import { MemoryLock, MemoryMeta } from './games/Memory';
import { ToastLauncher, ToastMeta } from './games/Toast';
import { ChairRocket, ChairMeta } from './games/Chair';
import { CakeCandles, CakeMeta } from './games/Cake';
import { TinyBridge, BridgeMeta } from './games/Bridge';
import { WrongButtons, ButtonsMeta } from './games/Buttons';
import { EscapeRoomba, RoombaMeta } from './games/Roomba';

export interface Registered {
  meta: MicrogameMeta;
  create: (scene: MicrogameHost, ctx: GameContext) => Microgame;
}

export const MICROGAMES: Registered[] = [
  { meta: CactusMeta, create: (s, c) => new CactusBalloon(s, c) },
  { meta: VendingMeta, create: (s, c) => new VendingMachine(s, c) },
  { meta: UmbrellaMeta, create: (s, c) => new UmbrellaEmergency(s, c) },
  { meta: CartMeta, create: (s, c) => new RunawayCart(s, c) },
  { meta: FanMeta, create: (s, c) => new FanProblem(s, c) },
  { meta: SoupMeta, create: (s, c) => new SoupDisaster(s, c) },
  { meta: HaircutMeta, create: (s, c) => new BadHaircut(s, c) },
  { meta: PlantMeta, create: (s, c) => new HungryPlant(s, c) },
  { meta: MemoryMeta, create: (s, c) => new MemoryLock(s, c) },
  { meta: ToastMeta, create: (s, c) => new ToastLauncher(s, c) },
  { meta: ChairMeta, create: (s, c) => new ChairRocket(s, c) },
  { meta: CakeMeta, create: (s, c) => new CakeCandles(s, c) },
  { meta: BridgeMeta, create: (s, c) => new TinyBridge(s, c) },
  { meta: ButtonsMeta, create: (s, c) => new WrongButtons(s, c) },
  { meta: RoombaMeta, create: (s, c) => new EscapeRoomba(s, c) },
];

export const META_BY_ID: Record<string, MicrogameMeta> = Object.fromEntries(MICROGAMES.map((m) => [m.meta.id, m.meta]));
