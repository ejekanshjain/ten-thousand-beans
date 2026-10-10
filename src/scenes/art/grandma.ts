import {
  blobPoints,
  boilSeed,
  palette,
  sketchBlob,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchPolygon,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'
import { colors } from './colors'
import { shoutSize } from './shout'

// ---------------------------------------------------------------- Grandma Doris

const SKIN: SketchStyle = { fill: colors.skin, width: 3, wobble: 1.2 }
const CARDIGAN: SketchStyle = { fill: palette.purple, width: 3, wobble: 1.4 }
const CARDIGAN_HATCH: SketchStyle = {
  fill: '#5f3dc4',
  fillStyle: 'hatch',
  hatchGap: 8,
  width: 0,
  wobble: 1
}
const SKIRT: SketchStyle = {
  fill: '#adb5bd',
  width: 3,
  wobble: 1.4
}
const SLIPPER: SketchStyle = { fill: palette.pink, width: 2.5, wobble: 1 }
const HAIR: SketchStyle = { fill: '#dee2e6', width: 2.5, wobble: 1.2 }
const GLASSES: SketchStyle = { width: 2.2, wobble: 0.5, passes: 1 }
const DOT: SketchStyle = { fill: palette.ink, width: 0, wobble: 0.3 }
const LINE: SketchStyle = { width: 2.5, wobble: 0.8, passes: 1 }
const SLEEVE: SketchStyle = {
  width: 11,
  wobble: 1,
  passes: 1,
  color: palette.purple
}
const SPOON: SketchStyle = {
  width: 5,
  wobble: 0.6,
  passes: 1,
  color: colors.wood
}
const SPOON_BOWL: SketchStyle = { fill: colors.wood, width: 2, wobble: 0.6 }
const BROOCH: SketchStyle = { fill: colors.bean, width: 1.5, wobble: 0.4 }
const BLUSH: SketchStyle = { fill: 'rgba(250, 82, 82, 0.25)', width: 0 }
const SHAKER: SketchStyle = { fill: palette.paper, width: 2.5, wobble: 0.8 }
const STOCKING: SketchStyle = {
  width: 7,
  wobble: 0.8,
  passes: 1,
  color: '#e9c9a8'
}
const SMILE: SketchStyle & { smooth: boolean } = {
  width: 2.5,
  wobble: 0.8,
  passes: 1,
  smooth: true,
  seed: 625
}
const MOUTH = [-6, -167, 0, -164, 6, -167]
const skirt = new Float64Array(8)

/** What Grandma is doing with her hands and face. */
export type GrandmaPose = 'wait' | 'count' | 'taste' | 'salt' | 'shrug'

/**
 * Grandma Doris from the front: slippers, a grey skirt, a purple cardigan with a bean
 * brooch, round glasses and a bun, with her wooden spoon. Feet at (x, feet). She talks
 * while `talking` is true.
 */
export function drawGrandma(
  ctx: CanvasRenderingContext2D,
  x: number,
  feet: number,
  scale: number,
  pose: GrandmaPose,
  talking: boolean,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  ctx.save()
  ctx.translate(x, feet)
  ctx.scale(scale, scale)
  // A gentle sway, like she's been standing at the door a while.
  ctx.rotate(Math.sin(timeMs / 900) * 0.015)

  STOCKING.seed = 600 + boil
  sketchLine(ctx, -10, -42, -12, -8, STOCKING)
  sketchLine(ctx, 10, -42, 12, -8, STOCKING)
  SLIPPER.seed = 601
  sketchEllipse(ctx, -15, -5, 15, 7, SLIPPER)
  sketchEllipse(ctx, 15, -5, 15, 7, SLIPPER)
  skirt.set([-30, -96, 30, -96, 38, -38, -38, -38])
  SKIRT.seed = 602 + boil
  sketchPolygon(ctx, skirt, SKIRT)

  CARDIGAN.seed = 603 + boil
  sketchRoundRect(ctx, -36, -156, 72, 66, 16, CARDIGAN)
  CARDIGAN_HATCH.seed = 604
  sketchRoundRect(ctx, -32, -150, 64, 58, 14, CARDIGAN_HATCH)
  LINE.color = palette.ink
  LINE.seed = 605
  sketchLine(ctx, 0, -150, 0, -92, LINE)
  for (let i = 0; i < 3; i++) {
    DOT.seed = 606 + i
    sketchCircle(ctx, 5, -140 + i * 18, 2.5, DOT)
  }
  BROOCH.seed = 609
  sketchEllipse(ctx, -18, -136, 6, 4, BROOCH)

  // Arms: the left one hangs or holds up a finger, the right one holds the spoon.
  const t = timeMs / 1000
  const leftHand =
    pose === 'count'
      ? { x: -44, y: -168 + Math.sin(t * 9) * 4 }
      : pose === 'shrug'
        ? { x: -62, y: -150 }
        : { x: -40, y: -96 }
  const rightHand =
    pose === 'taste'
      ? { x: 10, y: -176 }
      : pose === 'salt'
        ? { x: 52, y: -168 + Math.abs(Math.sin(t * 14)) * 10 }
        : pose === 'shrug'
          ? { x: 62, y: -150 }
          : { x: 44, y: -104 }
  SLEEVE.seed = 610 + boil
  sketchLine(ctx, -32, -148, leftHand.x, leftHand.y, SLEEVE)
  sketchLine(ctx, 32, -148, rightHand.x, rightHand.y, SLEEVE)
  SKIN.seed = 611
  sketchCircle(ctx, leftHand.x, leftHand.y, 7, SKIN)
  if (pose === 'count') sketchLine(ctx, -44, -175, -44, -190, LINE)
  if (pose === 'salt') {
    SHAKER.seed = 612
    sketchRoundRect(ctx, rightHand.x - 7, rightHand.y - 30, 14, 26, 4, SHAKER)
    for (let i = 0; i < 4; i++) {
      DOT.seed = 613 + i
      sketchCircle(
        ctx,
        rightHand.x - 8 + ((i * 7 + Math.floor(t * 20)) % 16),
        rightHand.y - 34 - ((i * 13 + t * 300) % 40),
        1.6,
        DOT
      )
    }
  } else {
    // The wooden spoon, bowl up, or at her mouth for a taste.
    const tipX = pose === 'taste' ? -2 : rightHand.x + 10
    const tipY = pose === 'taste' ? -186 : rightHand.y - 66
    SPOON.seed = 617
    sketchLine(ctx, rightHand.x, rightHand.y + 8, tipX, tipY + 8, SPOON)
    SPOON_BOWL.seed = 618
    sketchEllipse(ctx, tipX, tipY, 7, 10, SPOON_BOWL)
  }
  SKIN.seed = 619
  sketchCircle(ctx, rightHand.x, rightHand.y, 7, SKIN)

  // Head, hair and bun, round glasses.
  SKIN.seed = 620 + boil
  sketchCircle(ctx, 0, -180, 24, SKIN)
  HAIR.seed = 621
  sketchEllipse(ctx, 0, -197, 25, 11, HAIR)
  sketchCircle(ctx, 0, -214, 11, HAIR)
  BLUSH.seed = 622
  sketchCircle(ctx, -14, -170, 5, BLUSH)
  sketchCircle(ctx, 14, -170, 5, BLUSH)
  GLASSES.seed = 623
  sketchCircle(ctx, -9, -182, 7.5, GLASSES)
  sketchCircle(ctx, 9, -182, 7.5, GLASSES)
  sketchLine(ctx, -2, -183, 2, -183, GLASSES)
  DOT.seed = 624
  if (pose === 'taste') {
    sketchLine(ctx, -12, -182, -6, -182, LINE)
    sketchLine(ctx, 6, -182, 12, -182, LINE)
  } else {
    sketchCircle(ctx, -9, -181, 2.2, DOT)
    sketchCircle(ctx, 9, -181, 2.2, DOT)
  }
  const open = talking && Math.sin(t * 16) > 0
  if (pose === 'taste') sketchLine(ctx, -6, -166, 6, -167, LINE)
  else if (open) sketchEllipse(ctx, 0, -166, 4, 3.5, DOT)
  else sketchPath(ctx, MOUTH, SMILE)
  ctx.restore()
}

// ---------------------------------------------------------------- Her dog

const FUR: SketchStyle = { fill: '#ffffff', width: 2.5, wobble: 1.2 }
const BOW: SketchStyle = { fill: palette.pink, width: 2, wobble: 0.6 }
const LEG: SketchStyle = { width: 4, wobble: 0.6, passes: 1, color: '#495057' }
const TONGUE: SketchStyle = { fill: '#ff8787', width: 1.5, wobble: 0.5 }
const TAIL: SketchStyle = { width: 4, wobble: 0.8, passes: 1, seed: 631 }
const WOOF: SketchTextStyle = {
  font: 'marker',
  size: 26,
  color: palette.red,
  outline: palette.paper,
  rotate: -0.15
}
const ATCHOO: SketchTextStyle = {
  font: 'marker',
  size: 24,
  color: palette.inkSoft,
  outline: palette.paper,
  rotate: -0.15,
  seed: 641
}
const blob = new Float64Array(28)
const bow = new Float64Array(6)

/** What the doorstep dog is doing. */
export type DoorDogPose = 'sit' | 'bark' | 'jump' | 'sneeze'

/**
 * Grandma's small white dog side-on: a scruffy blob with a pink bow. `facing` -1 looks
 * left. Feet at (x, feet).
 */
export function drawDoorDog(
  ctx: CanvasRenderingContext2D,
  x: number,
  feet: number,
  facing: number,
  scale: number,
  pose: DoorDogPose,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  ctx.save()
  ctx.translate(x, feet)
  ctx.scale(facing * scale, scale)
  if (pose === 'jump') ctx.rotate(-0.6)
  const hop = pose === 'bark' ? Math.abs(Math.sin(timeMs / 90)) * 5 : 0
  ctx.translate(0, -hop)
  LEG.seed = 630 + boil
  if (pose === 'jump') {
    sketchLine(ctx, 12, -12, 28, -4, LEG)
    sketchLine(ctx, -12, -12, -26, -2, LEG)
  } else {
    for (const lx of [-12, -5, 8, 14]) sketchLine(ctx, lx, -10, lx, 0, LEG)
  }
  // The tail wags while it sits, and goes stiff when it barks.
  const wag = pose === 'sit' ? Math.sin(timeMs / 120) * 6 : 0
  sketchLine(ctx, -18, -20, -28, -32 + wag, TAIL)
  FUR.seed = 632 + boil
  blobPoints(0, -20, 17, 14, 633, 0.35, blob)
  for (let i = 1; i < blob.length; i += 2)
    blob[i] = -20 + ((blob[i] as number) + 20) * 0.7
  sketchBlob(ctx, blob, FUR, 14)
  // Head with floppy ears, a bow and a black nose.
  blobPoints(17, -34, 12, 12, 634, 0.3, blob)
  FUR.seed = 635 + boil
  sketchBlob(ctx, blob, FUR, 12)
  FUR.seed = 636
  sketchEllipse(ctx, 10, -30, 5, 9, FUR)
  bow.set([14, -48, 6, -54, 6, -42])
  BOW.seed = 637
  sketchPolygon(ctx, bow, BOW)
  bow.set([14, -48, 22, -54, 22, -42])
  sketchPolygon(ctx, bow, BOW)
  DOT.seed = 638
  sketchCircle(ctx, 28, -36, 3, DOT)
  if (pose === 'sneeze') {
    sketchLine(ctx, 17, -38, 23, -36, LINE)
  } else sketchCircle(ctx, 20, -38, 2, DOT)
  if (pose === 'bark' || pose === 'jump') {
    TONGUE.seed = 639
    sketchEllipse(ctx, 26, -26, 4, 6, TONGUE)
  }
  ctx.restore()
  if (pose === 'bark' && Math.floor(timeMs / 260) % 2 === 0) {
    WOOF.seed = 640 + boil
    WOOF.size = shoutSize(26, timeMs)
    sketchText(ctx, 'WOOF!', x + facing * 30 * scale, feet - 72 * scale, WOOF)
  }
  if (pose === 'sneeze') {
    ATCHOO.size = shoutSize(24, timeMs)
    sketchText(
      ctx,
      'Atchoo!',
      x + facing * 40 * scale,
      feet - 70 * scale,
      ATCHOO
    )
  }
}

// ---------------------------------------------------------------- Stew and doormat

const CAULDRON: SketchStyle = { fill: '#343a40', width: 3.5, wobble: 1.4 }
const CAULDRON_LEG: SketchStyle = {
  width: 8,
  wobble: 0.6,
  passes: 1,
  color: '#343a40',
  seed: 651
}
const CAULDRON_RIM: SketchStyle = { fill: '#495057', width: 3.5, wobble: 1.2 }
const STEW: SketchStyle = { fill: '#a0522d', width: 2, wobble: 1.6 }
const STEW_BEANS: SketchStyle = {
  fill: colors.bean,
  fillStyle: 'hatch',
  hatchGap: 5,
  color: colors.beanDark,
  width: 2
}
const STEAM: SketchStyle & { smooth: boolean } = {
  width: 3,
  wobble: 1.5,
  passes: 1,
  color: 'rgba(134, 142, 150, 0.6)',
  smooth: true
}
const steam = new Float64Array(8)

/** Grandma's stew pot: a big black pot with its rim centred at (x, rim), beans heaped inside, steaming. */
export function drawStew(
  ctx: CanvasRenderingContext2D,
  x: number,
  rim: number,
  timeMs: number
): void {
  const boil = boilSeed(timeMs)
  CAULDRON.seed = 650
  sketchRoundRect(ctx, x - 120, rim, 240, 120, 40, CAULDRON)
  sketchLine(ctx, x - 80, rim + 112, x - 92, rim + 134, CAULDRON_LEG)
  sketchLine(ctx, x + 80, rim + 112, x + 92, rim + 134, CAULDRON_LEG)
  CAULDRON_RIM.seed = 652
  sketchEllipse(ctx, x, rim, 132, 28, CAULDRON_RIM)
  STEW.seed = 653 + boil
  sketchEllipse(ctx, x, rim + 2, 118, 20, STEW)
  STEW_BEANS.seed = 654
  sketchEllipse(ctx, x, rim, 92, 14, STEW_BEANS)
  for (let i = 0; i < 3; i++) {
    const sx = x - 60 + i * 60
    const rise = ((timeMs / 1600 + i * 0.33) % 1) * 60
    steam.set([
      sx,
      rim - 20 - rise,
      sx + 10,
      rim - 40 - rise,
      sx - 6,
      rim - 60 - rise,
      sx + 4,
      rim - 80 - rise
    ])
    STEAM.seed = 655 + i + boil
    sketchPath(ctx, steam, STEAM)
  }
}

const MAT: SketchStyle = {
  fill: '#d9b77e',
  width: 3,
  wobble: 1.2,
  color: colors.woodDark
}
const MAT_HATCH: SketchStyle = {
  fill: '#b08155',
  fillStyle: 'hatch',
  hatchGap: 6,
  hatchAngle: 0.9,
  width: 0,
  wobble: 1
}
const MAT_ROLL: SketchStyle = { fill: '#b08155', width: 3, wobble: 1 }
const MAT_UNDER: SketchStyle = {
  fill: 'rgba(52, 58, 64, 0.25)',
  width: 0,
  wobble: 1
}
const MAT_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 30,
  color: colors.woodDark,
  seed: 668
}

/**
 * The WELCOME doormat centred at (x, y), `w` by `h`. Lifting rolls its near edge up by
 * `lift` u. `bump` draws the lump a bean makes under it.
 */
export function drawDoormat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  lift: number,
  bump: boolean
): void {
  const top = y - h / 2
  const bottom = y + h / 2 - lift
  if (lift > 0) {
    MAT_UNDER.seed = 660
    sketchRect(ctx, x - w / 2 + 4, bottom, w - 8, lift, MAT_UNDER)
  }
  MAT.seed = 661
  sketchRect(ctx, x - w / 2, top, w, bottom - top, MAT)
  MAT_HATCH.seed = 662
  sketchRect(ctx, x - w / 2 + 6, top + 6, w - 12, bottom - top - 12, MAT_HATCH)
  if (bottom - top > 40)
    sketchText(ctx, 'WELCOME', x, Math.min(y, bottom - 24), MAT_TEXT)
  if (bump && lift === 0) {
    MAT_ROLL.seed = 663
    sketchEllipse(ctx, x + 46, y + 20, 22, 11, MAT_ROLL)
    MAT.seed = 664
    sketchEllipse(ctx, x + 46, y + 18, 16, 7, MAT)
  }
  if (lift > 0) {
    MAT_ROLL.seed = 665
    sketchEllipse(
      ctx,
      x,
      bottom,
      w / 2 + 4,
      Math.min(14, 4 + lift / 6),
      MAT_ROLL
    )
  }
}

/** The doormat in the walk view: a thin mat on the landing, lumpy once a bean hides under it. */
export function drawSideDoormat(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  bump: boolean
): void {
  MAT.seed = 666
  sketchRect(ctx, x - 40, ground - 6, 80, 8, MAT)
  if (bump) {
    MAT.seed = 667
    sketchEllipse(ctx, x + 10, ground - 7, 9, 5, MAT)
  }
}
