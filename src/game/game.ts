import { settings } from '../shared'
import {
  createDoor,
  stepDoorTimers,
  stepDoorWalk,
  syncCountChores,
  updateEnding
} from './door'
import { ambushComing, createAmbush, updateAmbush } from './ambush'
import { closeDrain, tapHole, updateDrain } from './drainFlow'
import { caption, showing, sound } from './effects'
import { devForgetSpelling } from './gossipFlow'
import { clampLanding, emitBeans, landed } from './emit'
import { POT_OFFSET_X, stepCaptions } from './fx'
import { syncChores, updateGate } from './gate'
import {
  createKitchen,
  inKitchen,
  introBusy,
  kitchenPickupClosed,
  kitchenPickupOpened,
  kitchenPotLifted,
  shooPickupCat,
  updateKitchen
} from './kitchen'
import { move } from './ledger'
import { updateNet } from './net'
import { closePickup, openPickup, updatePickup } from './pickupFlow'
import { clearFlock, shooPigeons, updateFlock } from './pigeons'
import {
  effectiveAngle,
  isTeetering,
  kickPot,
  resetPot,
  spillSide,
  steerPot,
  stepSpill,
  stepSurface,
  stepTip
} from './slosh'
import {
  closeSpillIfQuiet,
  grandmaLine,
  grandmaTier,
  noteSpill,
  spillHeadline,
  type FinishedSpill
} from './spill'
import { causeLine, line, scoreDodge, scoreHit } from './lines'
import { queueReplay, stepReplay } from './replays'
import { logStep } from './runLog'
import { inSpans, onSlope } from './route'
import { currentStretch, type Game, type GameInput } from './state'
import { puddleBean, updateDrying } from './drying'
import { kioskBlocked, openKiosk, refuseLeave, updateKiosk } from './kiosk'
import { createMarket, updateMarket } from './market'
import { createPark, shooPickupDog, stepWet, updatePark } from './park'
import { createStreet, updateStreet } from './street'
import { stepTerrain } from './terrain'
import {
  ACCEL_SLOSH,
  FAR_BEANS_HINT,
  MAX_SHAKE,
  PICKUP_REACH,
  SLOSH_SOUND_FROM,
  SLOW_MS,
  SLOW_SCALE,
  STROLL_SPEED,
  UPHILL_SCALE,
  CAT_SWAT_KICK,
  CAT_SWAT_SPLASH,
  CAT_SWAT_TILT,
  LID_TIP_SHARE,
  TIP_LOOSE,
  TIP_PILE,
  TITLE_MS
} from './tuning'
import { DEG } from './units'
import { createWalker, stepWalker, swayAccel } from './walk'
import { characterHit } from './hits'
import { closeBox, tipJar, updateBox, updateGrowth } from './windowBox'
import { lidLaunch, resetLid, stepLid, syncOptions } from './upgrades'
import {
  flooded,
  resetWeather,
  stepWeather,
  updatePour,
  weatherPickUp,
  weatherSetDown
} from './weather'
import {
  behind,
  drainFromPot,
  landFromPot,
  nearestZone,
  pileFromPot,
  pruneZones,
  type Zone
} from './zones'

export * from './state'
export { caption } from './effects'
export { clampLanding, rimPoint } from './emit'
export {
  pickupDrag,
  pickupPress,
  pickupRelease,
  pickupScoop
} from './pickupFlow'

// ---------------------------------------------------------------- Update

/** Advances the simulation by one fixed step of `dtMs` real milliseconds. */
export function updateGame(game: Game, dtMs: number, input: GameInput): void {
  const fx = game.fx
  logStep(game, dtMs)
  game.options.assist = settings.get().assist
  syncOptions(game)
  stepReplay(game, dtMs)
  // Real-time waits run on the wall clock in every scene, the window box included.
  updateGrowth(game)
  updateDrying(game)
  if (game.scene === 'box') {
    // The world pauses while the box is open.
    updateBox(game, dtMs)
    stepCaptions(fx.captions, dtMs)
    syncChores(game)
    syncCountChores(game)
    return
  }
  // Reduced Motion plays big spills at full speed instead of in slow motion.
  const slow = fx.slowMs > 0 && !settings.get().reducedMotion
  const scale = slow ? SLOW_SCALE : 1
  fx.slowMs = Math.max(0, fx.slowMs - dtMs)
  const simMs = dtMs * scale
  const dtS = simMs / 1000
  game.timeMs += simMs

  if (game.scene === 'walk' || game.scene === 'grounded') {
    updateStreet(game, simMs)
    updateMarket(game, simMs)
    updatePark(game, simMs)
    updateAmbush(game, simMs)
  }
  if (game.scene === 'walk') updateWalk(game, dtS, simMs, input)
  else if (game.scene === 'pickup') updatePickup(game, simMs, input)
  else if (game.scene === 'grounded') updatePour(game, dtMs)
  if (game.scene === 'pickup' || game.scene === 'grounded') {
    updateFlock(game, simMs)
    updateNet(game, simMs)
  } else if (game.scene === 'drain') updateDrain(game, simMs, input)
  else if (game.scene === 'kiosk') updateKiosk(game, simMs)
  else if (game.scene === 'count') updateEnding(game, simMs)
  if (inKitchen(game)) updateKitchen(game, simMs)
  stepDoorTimers(game, dtMs)

  fx.particles.step(dtS, (zoneId, kind, x, y) =>
    landed(game, zoneId, kind, x, y)
  )
  fx.ripples.step(dtMs)
  fx.shake = Math.max(0, fx.shake - fx.shake * 6 * (dtMs / 1000) - 0.02)
  fx.gaspMs = Math.max(0, fx.gaspMs - dtMs)
  fx.kick.ms = Math.max(0, fx.kick.ms - dtMs)
  fx.squash += (1 - fx.squash) * Math.min(1, 12 * dtS)
  stepCaptions(fx.captions, dtMs)
  if (fx.title) {
    fx.title.ageMs += dtMs
    if (fx.title.ageMs >= fx.title.lifeMs) fx.title = null
  }

  const finished = closeSpillIfQuiet(game.spill, game.timeMs)
  if (finished) spillFinished(game, finished)
  syncChores(game)
  syncCountChores(game)
}

function updateWalk(
  game: Game,
  dtS: number,
  simMs: number,
  input: GameInput
): void {
  const { walker, pot } = game
  if (!walker.carrying) return
  const def = currentStretch(game)
  const x0 = walker.x
  const cap = inSpans(def.slow, walker.x) ? STROLL_SPEED : Infinity
  const uphill = onSlope(def, walker.x) ? UPHILL_SCALE : 1
  const stepped = stepWalker(walker, input.walk, dtS, cap, uphill)
  if (stepped) {
    sound(game, 'thud', 0.15, 1.4 + game.random.fx() * 0.1)
    game.fx.squash = Math.min(game.fx.squash, 0.96)
  }
  // Walking off a cleared stretch leads to the kiosk, then on to the next stretch.
  if (
    updateGate(game, simMs) &&
    (openKiosk(game) || enterStretch(game, game.stretch + 1))
  )
    return
  if (stepDoorWalk(game, simMs)) return
  stepTerrain(game, x0, stepped)
  stepWet(game, x0, simMs)
  stepLid(game, simMs)
  const wind = stepWeather(game, simMs)
  steerPot(pot, input.tilt, dtS)
  const drive = ACCEL_SLOSH * walker.ax + swayAccel(walker)
  stepSurface(pot, drive, wind, game.options, dtS)
  const psiEff = effectiveAngle(pot)

  const tip = stepTip(pot, psiEff, game.options, simMs)
  if (tip === 'teeter') teeter(game)
  else if (tip === 'saved') {
    sound(game, 'pop', 0.7, 1.3)
    caption(game, line(game, 'saved'), 'good', '', 2600, {
      score: scoreDodge(game.scores, 'tip')
    })
  } else if (tip === 'tipped') {
    tipOver(game)
    return
  }
  if (isTeetering(pot)) return

  const n = stepSpill(pot, psiEff, game.counts.pot, game.options, dtS)
  if (n > 0) emitBeans(game, n, spillSide(pot.phi), pot.overflow)
  sloshSound(game)
}

/** Plays a slosh at each surface swing peak past SLOSH_SOUND_FROM degrees. */
function sloshSound(game: Game): void {
  const level = Math.abs(game.pot.phi)
  const rising = level > game.sloshPrev
  if (game.sloshRising && !rising && level > SLOSH_SOUND_FROM * DEG)
    sound(game, 'slosh', Math.min(1, level / (20 * DEG)), 1)
  game.sloshRising = rising
  game.sloshPrev = level
}

/**
 * A spill event ended: its caption names the cause and count with Grandma's reaction and
 * the cause's running score, and its replay queues.
 */
function spillFinished(game: Game, spill: FinishedSpill): void {
  const { count, cause } = spill
  const previousBiggest = game.stats.biggestSpill
  game.stats.biggestSpill = Math.max(previousBiggest, count)
  const lead = causeLine(game, cause)
  const sub = grandmaLine(game, grandmaTier(cause, count))
  caption(game, spillHeadline(lead, count), 'bad', sub, 3400, {
    score: scoreHit(game.scores, cause)
  })
  queueReplay(game, { ...spill, lead, grandma: sub, previousBiggest })
}

/** The pot balances on one edge: a creak, a rattle, and a warning to tilt back. */
function teeter(game: Game): void {
  sound(game, 'creak', 0.8, 0.9)
  sound(game, 'rattle', 0.6, 0.6)
  caption(game, 'Whoa whoa whoa!', 'bad', 'Tilt back!', 900)
}

/** Records a bump so spill captions can blame it, and applies it to the pot. */
export function kick(
  game: Game,
  cause: string,
  surface: number,
  potKick = 0
): void {
  kickPot(game.pot, surface, potKick)
  game.lastKick = { cause, at: game.timeMs }
}

/**
 * The pot falls over: TIP_LOOSE beans scatter and TIP_PILE land in a pile. The Pot Lid
 * flies off, but holds back half the loose beans first.
 */
export function tipOver(game: Game): void {
  const { counts, walker, pot, fx } = game
  const side = pot.teeterSide || Math.sign(effectiveAngle(pot)) || 1
  const lidded = lidLaunch(game, side)
  const scatter = lidded ? Math.round(TIP_LOOSE * LID_TIP_SHARE) : TIP_LOOSE
  const loose = Math.min(scatter, counts.pot)
  const pile = Math.min(TIP_PILE, counts.pot - loose)
  game.lastKick = { cause: 'tip', at: game.timeMs }
  if (loose > 0) emitBeans(game, loose, side, 30)
  if (pile > 0) {
    const zone = landFromPot(
      counts,
      game.zones,
      game.stretch,
      clampLanding(game, walker.x + POT_OFFSET_X + side * 90),
      0,
      game.random.zones
    )
    pileFromPot(counts, zone, pile)
    zone.shown = Math.min(zone.count + zone.pile, zone.shown + pile)
    noteSpill(game.spill, pile, side, game.timeMs, () => 'tip')
    game.stats.spilled += pile
    game.stretchSpilled += pile
  }
  // A spill already pouring when it tipped takes the tip's name, caption and replay.
  if (game.spill.active) game.spill.cause = 'tip'
  resetPot(pot)
  walker.v = 0
  sound(game, 'thud', 1, 0.6)
  fx.shake = MAX_SHAKE
  fx.slowMs = SLOW_MS * 1.5
}

// ---------------------------------------------------------------- Stretches

/**
 * Starts stretch `index` at its beginning with the pot in your hands and a title card.
 * Returns false past the end of the route.
 */
export function enterStretch(game: Game, index: number): boolean {
  const def = game.route[index]
  if (!def) return false
  const fx = game.fx
  fx.particles.landAll((zoneId, kind) => landed(game, zoneId, kind))
  pruneZones(game.zones)
  game.stretch = index
  game.scene = 'walk'
  if (def.id === 'kitchen') game.kitchen = createKitchen(false)
  game.door = createDoor()
  game.street = createStreet(def, game.random.events)
  game.market = createMarket(def, game.random.events)
  game.park = createPark(def)
  game.ambush = createAmbush(def)
  resetLid(game)
  resetWeather(game)
  game.kiosk = null
  game.stretchSpilled = 0
  clearFlock(game.flock)
  Object.assign(game.walker, createWalker(0, def.length))
  resetPot(game.pot)
  game.spill.active = false
  game.lastKick = null
  Object.assign(game.gate, {
    wobbleMs: 0,
    cooldownMs: 0,
    arrowMs: 0,
    passed: false
  })
  game.lastBehind = -1
  game.lastDrain = -1
  fx.captions.length = 0
  fx.kick.ms = 0
  fx.shake = 0
  fx.title = {
    text: def.name,
    sub: `Stretch ${index + 1} of ${game.route.length}`,
    ageMs: 0,
    lifeMs: TITLE_MS
  }
  fx.cut++
  sound(game, 'whoosh', 0.5, 0.9)
  syncChores(game)
  game.out.push({ type: 'scene' })
  return true
}

// ---------------------------------------------------------------- Carry and set down

/** The zone that setting down here would open in Pickup, or null. */
export function zoneInReach(game: Game): Zone | null {
  return nearestZone(
    game.zones.list,
    game.stretch,
    game.walker.x + 60,
    PICKUP_REACH
  )
}

/**
 * Space or the Set Down / Pick Up Pot button. In the Drain scene it is Back, in the window
 * box Close, and at the kiosk Next Stretch.
 */
export function toggleCarry(game: Game): void {
  if (game.scene === 'walk' && game.walker.carrying) void setDown(game)
  else if (game.scene === 'box') closeBox(game)
  else if (game.scene === 'drain') closeDrain(game)
  else if (game.scene === 'kiosk') leaveKiosk(game)
  else if (game.scene === 'pickup' || game.scene === 'grounded') pickUp(game)
}

/**
 * Next Stretch at the kiosk: on to the next stretch with the pot in your hands, unless a
 * chore still blocks leaving. Returns true when you left.
 */
export function leaveKiosk(game: Game): boolean {
  if (game.scene !== 'kiosk') return false
  if (kioskBlocked(game)) {
    refuseLeave(game)
    return false
  }
  return enterStretch(game, game.stretch + 1)
}

/**
 * Why the pot can't go down right now, as a caption and its second line, or null. Setting
 * it down would dodge a fail already under way: a teeter only a counter-tilt saves, beans
 * pouring over the rim, or an ambush only hurrying escapes. A flooded pot can always go
 * down, since pouring the water off is its only fix.
 */
export function setDownRefusal(game: Game): [string, string] | null {
  if (isTeetering(game.pot)) return ['Not now!', "It's on one edge. Tilt back!"]
  if (ambushComing(game))
    return [
      'No time!',
      game.touch
        ? 'Hurry past! Slide your thumb right.'
        : 'Hurry past! Hold Shift with W.'
    ]
  if (game.spill.active && !flooded(game))
    return ['Not mid-spill!', 'Level the pot, then set it down.']
  return null
}

/**
 * Puts the pot on the ground anywhere. Within reach of a zone this opens Pickup. Returns
 * false with a buzz and the reason when `setDownRefusal` says it can't go down yet.
 */
export function setDown(game: Game): boolean {
  const refusal = setDownRefusal(game)
  if (refusal) {
    sound(game, 'buzz', 0.5, 1.2)
    const key = `setdown ${refusal[0]}`
    if (!showing(game, key))
      caption(game, refusal[0], 'bad', refusal[1], 1400, { key })
    return false
  }
  const fx = game.fx
  fx.particles.landAll((zoneId, kind) => landed(game, zoneId, kind))
  const zone = zoneInReach(game)
  game.walker.carrying = false
  game.walker.v = 0
  game.walker.ax = 0
  resetPot(game.pot)
  fx.captions.length = 0
  sound(game, 'thud', 0.5, 0.9)
  weatherSetDown(game)
  tipJar(game)
  if (zone) {
    openPickup(game, zone)
    if (inKitchen(game)) kitchenPickupOpened(game, zone.id)
  } else {
    game.scene = 'grounded'
    pointToBeans(game)
  }
  game.out.push({ type: 'scene' })
  return true
}

/**
 * Setting the pot down near spilled beans but out of PICKUP_REACH says which way they
 * are, so the miss doesn't look like the game ignoring you.
 */
function pointToBeans(game: Game): void {
  const potX = game.walker.x + POT_OFFSET_X
  const near = nearestZone(game.zones.list, game.stretch, potX, FAR_BEANS_HINT)
  if (!near) return
  caption(
    game,
    'Too far from the beans.',
    'info',
    near.anchorX < potX
      ? 'Pick the pot up and set it down further back.'
      : 'Pick the pot up and set it down further on.',
    2800
  )
}

/**
 * Picks the pot back up and returns to walking. Refused while you hold beans, and while
 * the cat's opening gag plays.
 */
export function pickUp(game: Game): boolean {
  if (game.pickup.carry.count > 0) return false
  if (introBusy(game)) {
    caption(game, 'Hold on.', 'info', 'The cat is up to something.', 1800)
    return false
  }
  closePickup(game)
  pruneZones(game.zones)
  clearFlock(game.flock)
  game.scene = 'walk'
  game.walker.carrying = true
  resetPot(game.pot)
  game.fx.captions.length = 0
  sound(game, 'whoosh', 0.4, 1.2)
  weatherPickUp(game)
  if (inKitchen(game)) {
    kitchenPickupClosed(game)
    kitchenPotLifted(game)
  }
  game.out.push({ type: 'scene' }, { type: 'potLifted' })
  return true
}

/**
 * A tap or click in Pickup that isn't a grab: it shoos a cat before it bats or a dog
 * before it dashes, scatters pigeons, or opens a drain. Returns true when the tap did something, so it doesn't
 * also grab.
 */
export function pickupTap(game: Game, x: number, y: number): boolean {
  return (
    shooPickupCat(game, x, y) ||
    shooPickupDog(game, x, y) ||
    shooPigeons(game, x, y) ||
    tapHole(game, x, y)
  )
}

/**
 * A tap or click in the walk view with the pot on the ground, at world (x, y): it
 * scatters pigeons. Returns true when it did.
 */
export function groundTap(game: Game, x: number, y: number): boolean {
  return game.scene === 'grounded' && shooPigeons(game, x, y)
}

// ---------------------------------------------------------------- Queries

/** Beans still on the ground in this stretch. */
export function beansBehind(game: Game): number {
  return behind(game.zones.list, game.stretch)
}

// ---------------------------------------------------------------- Dev helpers

/**
 * Dev: drops `n` beans from the pot into one zone `ahead` u in front of you, on the
 * ground or down a drain. Returns false outside the walk view.
 */
export function devSpill(
  game: Game,
  n: number,
  into: 'loose' | 'drain' | 'puddle' = 'loose',
  ahead = 120
): boolean {
  if (game.scene !== 'walk' || !game.walker.carrying) return false
  const count = Math.min(n, game.counts.pot)
  const landX = clampLanding(game, game.walker.x + ahead)
  const zone = landFromPot(
    game.counts,
    game.zones,
    game.stretch,
    landX,
    into === 'loose' ? count : 0,
    game.random.zones
  )
  if (into === 'drain') drainFromPot(game.counts, zone, count)
  if (into === 'puddle') {
    const span = { from: landX - 40, to: landX + 40 }
    let left = count
    while (left > 0 && puddleBean(game, zone, span)) left--
  }
  zone.shown = zone.count + zone.pile
  game.stats.spilled += count
  return true
}

/** Puts every bean in a zone straight back in the pot, for dev helpers and bots. */
export function returnZone(game: Game, zone: Zone): void {
  move(game.counts, 'loose', 'pot', zone.count - zone.puddle)
  move(game.counts, 'puddle', 'pot', zone.puddle)
  move(game.counts, 'pile', 'pot', zone.pile)
  move(game.counts, 'drain', 'pot', zone.drain)
  zone.count = zone.puddle = zone.pile = zone.drain = zone.shown = 0
}

/** Dev: puts every bean on the ground in this stretch back in the pot. */
export function devPickUpAll(game: Game): void {
  if (game.drain) closeDrain(game)
  if (game.pickup.world) {
    closePickup(game)
    game.scene = 'grounded'
  }
  devForgetSpelling(game)
  for (const zone of game.zones.list) {
    if (zone.stretch !== game.stretch) continue
    returnZone(game, zone)
  }
  pruneZones(game.zones)
  game.out.push({ type: 'scene' })
}

/**
 * Dev: jumps to the start of stretch `index`, putting every bean on the ground anywhere
 * back in the pot first. Returns false for an index outside the route.
 */
export function devJump(game: Game, index: number): boolean {
  if (index < 0 || index >= game.route.length) return false
  if (game.drain) closeDrain(game)
  closePickup(game)
  devForgetSpelling(game)
  for (const zone of game.zones.list) {
    returnZone(game, zone)
  }
  return enterStretch(game, index)
}

/**
 * Dev: opens the kiosk at the end of this stretch as if you had just cleared it, with
 * every spilled bean back in the pot. Returns false on the last stretch.
 */
export function devKiosk(game: Game): boolean {
  if (game.scene === 'kiosk') return true
  devPickUpAll(game)
  game.walker.x = currentStretch(game).length - 20
  return openKiosk(game)
}

/** Dev: the door cat swats the pot right now, wherever you are. */
export function devCatSwat(game: Game): void {
  if (game.scene !== 'walk' || !game.walker.carrying) return
  const cat = game.kitchen.cat
  cat.phase = 'windup'
  cat.ms = 0
  cat.swattedThisPass = true
  if (!inKitchen(game)) {
    // Outside the kitchen there is no cat to step, so land the hit at once.
    cat.phase = 'smug'
    characterHit(game, {
      cause: 'cat',
      side: 1,
      kick: CAT_SWAT_KICK,
      tilt: CAT_SWAT_TILT,
      splash: CAT_SWAT_SPLASH
    })
  }
}

/** Dev: in kitchen Pickup, the cat walks in for a bat now. */
export function devCatBat(game: Game): void {
  game.kitchen.pickupCat.wait = 0
}

/** Dev: starts a teeter as if a hit pushed the pot past the tip angle. */
export function devTeeter(game: Game, side = 1): void {
  if (game.scene !== 'walk' || !game.walker.carrying) return
  const pot = game.pot
  pot.teeterMs = 1
  pot.teeterSide = side
  pot.teeterFrom = pot.psiTarget
  game.lastKick = { cause: 'tip', at: game.timeMs }
  teeter(game)
}
