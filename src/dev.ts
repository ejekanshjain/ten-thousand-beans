// Dev-only scripting hooks. App.tsx loads this file with a dynamic import inside an
// import.meta.env.DEV check, so production builds never include it.
import {
  endSession,
  exposeDev,
  settings,
  toast,
  type DevAction,
  type LoopDevApi
} from './shared'
import { createElement, type ReactNode } from 'react'

import { devAmbush } from './game/ambush'
import { Bot, BOTS, type BotName } from './game/bot'
import {
  beansBehind,
  currentStretch,
  devCatBat,
  devCatSwat,
  devJump,
  devKiosk,
  devPickUpAll,
  devSpill,
  devTeeter
} from './game/game'
import { devCount, devDoorDog } from './game/door'
import { devGiveGossip } from './game/gossipFlow'
import { devFeet, devLadder, devShopper, devSpoon } from './game/market'
import { checkPackets, loseBeans, packetLabel } from './game/packets'
import { devDog, devFootball, devWhoa } from './game/park'
import { knotSpot } from './game/net'
import { devPigeon } from './game/pigeons'
import { devOwn, type UpgradeId } from './game/upgrades'
import { devFinishGrowing, toggleBox } from './game/windowBox'
import { devGust, devRain } from './game/weather'
import { devCyclist, devNeighbour } from './game/street'
import { hud } from './game/hud'
import { groundDrop } from './game/route'
import {
  reportText,
  runReport,
  startTrial,
  trialResult,
  trialText,
  type Trial,
  type TrialResult
} from './game/runLog'
import { total } from './game/ledger'
import { POT_X, POT_Y, TOTAL_BEANS } from './game/tuning'
import { checkBox } from './game/windowBox'
import { checkZones } from './game/zones'
import { devHooks } from './scenes/devHooks'
import { film } from './scenes/film'
import type { InputOverride } from './scenes/input'
import type { Runtime } from './scenes/runtime'
import { devReport, EndingReport, RunReportModal } from './ui/DevReport'

/** Beans in one timed pickup for M27. */
const TRIAL_BEANS = 50

/** What `installDev` hands the React shell: panel actions and the Run Report pieces. */
export interface DevTools {
  remove: () => void
  actions: DevAction[]
  /** Opens the Run Report dialog, from the phone Menu or the dev panel. */
  openReport: () => void
  /** The Run Report dialog; mount it once. */
  Overlay: () => ReactNode
  /** The report folded into the ending screen. */
  EndingExtra: () => ReactNode
}

/** Publishes `window.__game.beans` and returns the dev panel actions and Run Report. */
export function installDev(runtime: Runtime): DevTools {
  const game = runtime.game
  const viewport = runtime.viewport

  /** Logical design coordinates to client (CSS) coordinates, for PointerEvent scripts. */
  const toClient = (x: number, y: number): [number, number] => {
    const rect = viewport.canvas?.getBoundingClientRect()
    const left = rect?.left ?? 0
    const top = rect?.top ?? 0
    return [
      left + viewport.offsetX + x * viewport.scale,
      top + viewport.offsetY + y * viewport.scale
    ]
  }

  /** Knot `i` of the Pigeon Net in design coordinates, in Pickup or the walk view. */
  const knotXY = (i: number): [number, number] => {
    const at = knotSpot(game, i, { x: 0, y: 0 })
    if (game.flock.view === 'pickup') return [at.x, at.y]
    const camera = runtime.walkScene.camera
    return [at.x - camera.x + camera.shakeX, at.y - camera.y + camera.shakeY]
  }

  /** The first way the bean ledger disagrees with itself, or null. */
  const ledgerProblem = (): string | null => {
    const sum = total(game.counts)
    if (sum !== TOTAL_BEANS)
      return `the ledger holds ${sum} beans instead of ${TOTAL_BEANS}`
    return (
      checkZones(game.counts, game.zones.list) ??
      checkPackets(game.counts, game.packets) ??
      checkBox(game.counts, game.box)
    )
  }

  const checkLedger = () => ({
    total: total(game.counts),
    problem: ledgerProblem()
  })

  // Every update step checks the ledger, and the first mismatch goes to the console.
  devHooks.afterUpdate = () => {
    const problem = ledgerProblem()
    if (!problem) return
    devHooks.afterUpdate = null
    console.error(
      `Bean ledger check failed: ${problem}. Later mismatches stay silent.`
    )
  }

  /** The 50-bean timing running now, and the ones finished this page load. */
  let trial: Trial | null = null
  const trials: TrialResult[] = []

  /**
   * Spills 50 beans ahead of you, spread like a hurried spill, and times their pickup.
   * Returns why it can't start, or null once it has.
   */
  const timeBeans = (): string | null => {
    if (trial) return 'A timed pickup is already running.'
    if (game.scene !== 'walk' || !game.walker.carrying)
      return 'Start this while carrying the pot.'
    if (beansBehind(game) > 0) return 'Pick up the beans behind you first.'
    const next = startTrial(game)
    for (let i = 0; i < 10; i++)
      devSpill(game, TRIAL_BEANS / 10, 'loose', 60 + i * 10)
    trial = next
    runtime.publish()
    return null
  }

  const checkTrial = () => {
    if (!trial) return
    if (game.stretch !== trial.stretch) {
      trial = null
      toast('Timed pickup dropped: you left its stretch.', 'bad')
      return
    }
    const result = trialResult(game, trial)
    if (!result) return
    trial = null
    if (result.beans === 0) {
      toast('Timed pickup dropped: no beans went in by hand.', 'bad')
      return
    }
    trials.push(result)
    toast(`Timed: ${trialText(result)}.`, 'good', 8000)
  }
  const trialTimer = window.setInterval(checkTrial, 250)

  const report = () => reportText(runReport(game, Date.now()), trials)

  const api = {
    /** Reloads the page without the leave warning, which would otherwise block it. */
    reload() {
      endSession()
      location.reload()
    },
    /** Starts the game without the start screen. */
    start() {
      runtime.begin()
      hud.set({ started: true })
    },
    state() {
      return {
        scene: game.scene,
        stretch: game.stretch,
        stretchName: currentStretch(game).name,
        drop: groundDrop(currentStretch(game), game.walker.x),
        tiles: runtime.walkScene.tiles?.size ?? 0,
        kick: { ...game.fx.kick },
        title: game.fx.title?.text ?? null,
        counts: { ...game.counts },
        behind: beansBehind(game),
        walker: { ...game.walker },
        kitchen: {
          intro: game.kitchen.intro,
          introZone: game.kitchen.introZone,
          potOnCounter: game.kitchen.potOnCounter,
          cat: { ...game.kitchen.cat },
          pickupCat: { ...game.kitchen.pickupCat }
        },
        pot: { ...game.pot },
        zones: game.zones.list.map(z => ({
          id: z.id,
          anchorX: Math.round(z.anchorX),
          count: z.count,
          pile: z.pile,
          puddle: z.puddle,
          shown: z.shown,
          drain: z.drain
        })),
        gossip: {
          status: [...game.gossip.status],
          started: game.gossip.started,
          spelling: game.gossip.spelling ? { ...game.gossip.spelling } : null,
          jot: game.gossip.jot.level,
          letters: (game.pickup.world?.letters ?? []).map(l => [
            Math.round(l.toX),
            Math.round(l.toY)
          ])
        },
        drain: game.drain
          ? {
              variant: game.drain.variant,
              hook: { ...game.drain.world.hook },
              held: game.drain.world.held !== null,
              junk: game.drain.world.heldJunk?.id ?? null,
              beans: game.drain.world.beans.map(b => [
                Math.round(b.position.x),
                Math.round(b.position.y)
              ])
            }
          : null,
        street: {
          lean: game.pot.lean,
          neighbours: game.street.neighbours.map(n => ({
            look: n.look,
            door: n.door,
            x: Math.round(n.x),
            phase: n.phase,
            lean: n.lean,
            says: n.says,
            elbowed: n.elbowed
          })),
          cyclists: game.street.cyclists.map(c => ({
            trigger: c.trigger,
            phase: c.phase,
            x: Math.round(c.x),
            startled: c.startled
          }))
        },
        market: {
          ms: game.market.ms,
          shopper: game.market.shopper ? { ...game.market.shopper } : null,
          shoppers: game.market.shoppers,
          stalls: game.market.stalls.map(s => ({ ...s })),
          ladder: game.market.ladder ? { ...game.market.ladder } : null,
          feet: { ...game.market.feet, scuffed: game.market.feet.scuffed.size }
        },
        ambush: game.ambush
          ? { ...game.ambush, x: Math.round(game.ambush.x) }
          : null,
        grate: game.pickup.world?.grate ?? null,
        owned: [...game.shop.store.get().owned],
        lid: { ...game.lid, on: game.options.lid },
        mud: { on: game.mud.on, strokes: game.mud.strokes },
        park: {
          kicks: game.park.kicks.map(k => ({ ...k })),
          dogs: game.park.dogs.map(d => ({ ...d, x: Math.round(d.x) })),
          wet: game.park.wet.map(w => ({ ...w })),
          pickupDog: {
            ...game.park.pickupDog,
            pushed: game.park.pickupDog.pushed.size
          }
        },
        flock: {
          view: game.flock.view,
          waitMs: Math.round(game.flock.waitMs),
          eaten: game.flock.eaten,
          arrivals: game.flock.arrivals,
          pigeons: game.flock.pigeons.map(p => ({
            id: p.id,
            phase: p.phase,
            x: Math.round(p.x),
            y: Math.round(p.y),
            target: p.target,
            foiled: p.foiled
          }))
        },
        net: {
          phase: game.net.phase,
          active: game.net.active,
          knots: game.net.knots.map((k, i) => ({
            dir: k.dir,
            left: k.left,
            at: toClient(...knotXY(i))
          }))
        },
        tall: game.options.tall,
        door: {
          dog: game.door.dog,
          dogMs: Math.round(game.door.dogMs),
          dustpan: game.door.dustpan,
          says: game.door.says,
          phase: game.door.phase,
          ms: Math.round(game.door.ms),
          counted: game.door.counted,
          holding: game.door.holding,
          mat: game.door.mat,
          matUp: game.door.matUp,
          bean: toClient(game.door.bean.x, game.door.bean.y),
          secret: game.door.secretText
        },
        weather: {
          gust: { ...game.weather.gust },
          windPush: game.weather.windPush,
          raining: game.weather.raining,
          water: game.pot.water,
          drift: game.pot.drift,
          roll: game.weather.roll,
          ducks: game.pickup.world?.ducks.length ?? 0,
          gravity: game.weather.gravity,
          pouring: game.weather.pouring,
          pourLevel: game.weather.pour.level
        },
        packets: game.packets.list.map(packetLabel),
        box: {
          returnTo: game.box.returnTo,
          selected: game.box.selected,
          mode: game.box.mode,
          batch: game.box.batch
            ? Math.max(0, game.box.batch.endsAt - Date.now())
            : null,
          pea: game.box.pea,
          slots: game.box.slots.map(s => ({
            state: s.state,
            strokes: s.strokes,
            packets: s.packets.map(packetLabel)
          }))
        },
        kiosk: game.kiosk
          ? {
              ...game.kiosk.summary,
              says: game.kiosk.says,
              sold: [...game.kiosk.sold]
            }
          : null,
        stretchSpilled: game.stretchSpilled,
        drying: game.drying.map(t => Math.max(0, t.endsAt - Date.now())),
        puddles: game.pickup.world?.puddles ?? [],
        swollen: game.pickup.world?.swollen.size ?? 0,
        coins: game.wallet.coins(),
        carry: { ...game.pickup.carry },
        streak: game.pickup.streak,
        stats: { ...game.stats },
        replay: {
          pending: game.replays.pending?.label ?? null,
          settleMs: Math.round(game.replays.settleMs),
          shot: film.get().shot
            ? {
                id: film.get().shot!.id,
                label: film.get().shot!.label,
                blame: film.get().shot!.blame,
                frames: film.get().shot!.clip.frames.length,
                auto: film.get().shot!.auto,
                share: film.get().shot!.share
              }
            : null,
          open: film.get().open,
          best: runtime.film.best !== null
        },
        captions: game.fx.captions.map(c => `${c.text} ${c.sub}`.trim()),
        timeMs: game.timeMs
      }
    },
    /**
     * The run so far, for the balance pass: minutes per stretch by what you were doing,
     * spills, seconds in Pickup per bean potted, the pickup share and coins by source.
     */
    stats() {
      return runReport(game, Date.now())
    },
    /** The same report as the plain text the Run Report dialog shows. */
    statsText() {
      return report()
    },
    /**
     * Spills 50 beans ahead and times their pickup, as Time 50 Beans does. Returns why it
     * can't start, or null. Finished timings appear in `statsText()`.
     */
    timeBeans,
    /** Finished 50-bean timings, oldest first. */
    timings() {
      return trials.slice()
    },
    ledger() {
      return { ...game.counts, total: total(game.counts) }
    },
    checkLedger,
    /** Jumps to the start of stretch `n` (0 kitchen to 6 door), returning every spilled bean first. */
    jump(n: number) {
      const ok = devJump(game, n)
      runtime.publish()
      return ok
    },
    /** The route's stretches with their hazards, for scripts that walk to one. */
    route() {
      return game.route.map(s => ({
        id: s.id,
        name: s.name,
        length: s.length,
        bumps: s.bumps.map(b => `${b.kind}@${b.x}`),
        cobbles: s.cobbles.map(c => `${c.from}-${c.to}`),
        drains: s.drains,
        neighbours: s.neighbours,
        cyclists: s.cyclists
      }))
    },
    /** Jumps to Grandma's door with the pot in your hands, just short of the steps. */
    door(x = 540) {
      const ok = devJump(game, 6)
      game.walker.x = x
      runtime.publish()
      return ok
    },
    /** Jumps to Grandma's door and starts her count, with one bean under the doormat. */
    count() {
      devJump(game, 6)
      devCount(game)
      runtime.publish()
    },
    /** Hands walking and tilt to a scripted bot until called with null. */
    bot(name: BotName | null, seed = 1) {
      if (!name) {
        devHooks.driver = null
        return
      }
      const bot = new Bot(BOTS[name], seed)
      devHooks.driver = (input, g, dtS) => bot.drive(input, g, dtS)
    },
    /** Marks the next `count` gossip lines as jotted down. */
    giveGossip(count = 1) {
      devGiveGossip(game, count)
      runtime.publish()
    },
    /** Spills `n` beans just ahead, on the ground, down a drain or swollen in a puddle. */
    spill(n: number, into: 'loose' | 'drain' | 'puddle' = 'loose') {
      return devSpill(game, n, into)
    },
    /** Ends every real-time wait now: beans drying on the rack and the window box's batch. */
    finishWaits() {
      for (const timer of game.drying) timer.endsAt = Date.now()
      devFinishGrowing(game)
    },
    /** Opens or closes the window box, as E would. */
    box() {
      const ok = toggleBox(game)
      runtime.publish()
      return ok
    },
    pickUpAll() {
      devPickUpAll(game)
    },
    toggleCarry() {
      runtime.toggleCarry()
    },
    /**
     * Fires an event now: 'tip' teeters the pot, 'cat' swats it, 'fridge' sends the Pickup
     * cat in, 'neighbour' brings the next neighbour out just ahead, 'cyclist' rings a bell.
     */
    trigger(
      event:
        | 'tip'
        | 'cat'
        | 'fridge'
        | 'neighbour'
        | 'cyclist'
        | 'shopper'
        | 'spoon'
        | 'ladder'
        | 'feet'
        | 'pigeon'
        | 'football'
        | 'dog'
        | 'whoa'
        | 'gust'
        | 'rain'
        | 'doordog'
        | 'ambush'
    ) {
      if (event === 'tip') devTeeter(game)
      else if (event === 'cat') devCatSwat(game)
      else if (event === 'neighbour') return devNeighbour(game)
      else if (event === 'cyclist') return devCyclist(game)
      else if (event === 'shopper') return devShopper(game)
      else if (event === 'spoon') return devSpoon(game)
      else if (event === 'ladder') return devLadder(game)
      else if (event === 'feet') return devFeet(game)
      else if (event === 'pigeon') return devPigeon(game)
      else if (event === 'football') return devFootball(game)
      else if (event === 'dog') return devDog(game)
      else if (event === 'whoa') return devWhoa(game)
      else if (event === 'gust') return devGust(game)
      else if (event === 'rain') devRain(game, 6)
      else if (event === 'doordog') return devDoorDog(game)
      else if (event === 'ambush') return devAmbush(game)
      else devCatBat(game)
      return true
    },
    /** Moves `beans` from the pot into seed packets, as if pigeons ate them here. */
    givePackets(beans: number) {
      loseBeans(game, 'pot', Math.min(beans, game.counts.pot), 'pigeon')
      runtime.publish()
    },
    /** Owns upgrade `id` without paying for it, as if bought. */
    own(id: UpgradeId) {
      const ok = devOwn(game, id)
      runtime.publish()
      return ok
    },
    /** Adds coins, as a dodge would. */
    addCoins(n: number) {
      game.wallet.earn(n, 'Dev')
    },
    /** Opens the kiosk at the end of this stretch, with every spilled bean back in the pot. */
    kiosk() {
      const ok = devKiosk(game)
      runtime.publish()
      return ok
    },
    /** Sells jotted line `line` at the kiosk, as its Sell button would. */
    sell(line: number) {
      runtime.sell(line)
    },
    setInput(input: InputOverride | null) {
      runtime.input.override = input
    },
    setMotion(motion: { tiltX: number } | null) {
      runtime.input.motion.stub = motion
    },
    /** Turns Assist Mode on or off, as the Settings switch would. */
    assist(on: boolean) {
      settings.set({ assist: on })
    },
    step(n = 1) {
      const loop = window.__game?.loop as LoopDevApi | undefined
      loop?.step(n)
    },
    /** The latest sounds, loops and buzzes, newest last. Pass true to clear the log. */
    sounds(clear = false) {
      const out = devHooks.sounds.slice()
      if (clear) devHooks.sounds.length = 0
      return out
    },
    /** Captions on screen now, with their extra line and running score. */
    captions() {
      return game.fx.captions.map(c => [c.text, c.sub, c.score].filter(Boolean))
    },
    /** Client coordinates of every free bean and of the pot, for scripted drags. */
    beanPoints() {
      const world = game.pickup.world
      return {
        client: (world?.beans ?? []).map(b =>
          toClient(b.position.x, b.position.y)
        ),
        pot: toClient(POT_X, POT_Y)
      }
    },
    toClient
  }

  const unexpose = exposeDev('beans', api)
  const remove = () => {
    window.clearInterval(trialTimer)
    devHooks.driver = null
    devHooks.afterUpdate = null
    unexpose()
  }
  const openReport = () => devReport.set({ open: true })
  const onTrial = () => {
    const problem = timeBeans()
    toast(
      problem ?? 'Set the pot down by the beans and pick them all up.',
      problem ? 'bad' : 'info',
      problem ? 2600 : 5000
    )
  }
  const actions: DevAction[] = [
    { label: 'Start', run: api.start },
    { label: 'Run Report', run: openReport },
    { label: 'Time 50 Beans', run: onTrial },
    ...game.route.map((s, i) => ({
      label: `Jump ${s.name}`,
      run: () => void api.jump(i)
    })),
    { label: 'Kiosk', run: () => void api.kiosk() },
    { label: 'Bot Walk', run: () => api.bot('average') },
    { label: 'Bot Stop', run: () => api.bot(null) },
    { label: 'Spill 30', run: () => void devSpill(game, 30) },
    { label: 'Spill 300', run: () => void devSpill(game, 300) },
    { label: 'Drain 3', run: () => void devSpill(game, 3, 'drain') },
    { label: 'Puddle 3', run: () => void devSpill(game, 3, 'puddle') },
    { label: 'Finish Waits', run: () => api.finishWaits() },
    { label: 'All Gossip', run: () => api.giveGossip(12) },
    { label: 'Pick Up All', run: () => devPickUpAll(game) },
    { label: 'Trigger Tip', run: () => devTeeter(game) },
    { label: 'Trigger Cat', run: () => devCatSwat(game) },
    { label: 'Trigger Fridge', run: () => devCatBat(game) },
    { label: 'Trigger Neighbour', run: () => void devNeighbour(game) },
    { label: 'Trigger Cyclist', run: () => void devCyclist(game) },
    { label: 'Trigger Shopper', run: () => void devShopper(game) },
    { label: 'Trigger Spoon', run: () => void devSpoon(game) },
    { label: 'Trigger Ladder', run: () => void devLadder(game) },
    { label: 'Trigger Feet', run: () => void devFeet(game) },
    { label: 'Trigger Pigeon', run: () => void devPigeon(game) },
    { label: 'Trigger Ambush', run: () => void devAmbush(game) },
    { label: 'Trigger Football', run: () => void devFootball(game) },
    { label: 'Trigger Dog', run: () => void devDog(game) },
    { label: 'Trigger Whoa', run: () => void devWhoa(game) },
    { label: 'Trigger Gust', run: () => void devGust(game) },
    { label: 'Trigger Rain', run: () => devRain(game, 6) },
    { label: 'Trigger Door Dog', run: () => void devDoorDog(game) },
    { label: 'Count', run: () => api.count() },
    { label: 'Lose 10', run: () => api.givePackets(10) },
    { label: '+100 Coins', run: () => api.addCoins(100) },
    {
      label: 'Own Built Upgrades',
      run: () => {
        for (const u of game.shop.list()) devOwn(game, u.id as UpgradeId)
        runtime.publish()
      }
    },
    {
      label: 'Check Ledger',
      run: () => {
        const { total: sum, problem } = checkLedger()
        toast(
          problem ? `Ledger: ${problem}` : `Ledger holds ${sum} beans`,
          problem ? 'bad' : 'good'
        )
      }
    }
  ]
  return {
    remove,
    actions,
    openReport,
    Overlay: () => createElement(RunReportModal, { read: report, onTrial }),
    EndingExtra: () => createElement(EndingReport, { read: report })
  }
}
