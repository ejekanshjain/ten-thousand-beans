import { move, type Counts, type Place } from './ledger'
import type { StretchId } from './route'
import { stretchLog } from './runLog'
import { currentStretch, type Game } from './state'
import { PACKET_SIZE } from './tuning'

/** Why beans were lost for good. Each cause fills its own packets. */
export type LossCause = 'pigeon' | 'gull' | 'dog' | 'river' | 'pour'

const CAUSE_LABEL: Record<LossCause, string> = {
  pigeon: 'Pigeon Tax',
  gull: 'Gull Tax',
  dog: 'Dog Tax',
  river: 'River Tax',
  pour: 'Pour Tax'
}

const STRETCH_LABEL: Record<StretchId, string> = {
  kitchen: 'Kitchen',
  street: 'Street',
  market: 'Market',
  park: 'Park',
  hill: 'Hill',
  bridge: 'Bridge',
  door: 'Doorstep',
  test: 'Test'
}

/** A seed packet of up to PACKET_SIZE beans lost for good, waiting to be planted. */
export interface Packet {
  id: number
  cause: LossCause
  stretch: StretchId
  beans: number
}

/** Packets waiting to be planted, oldest first. */
export interface PacketSet {
  list: Packet[]
  nextId: number
}

export function createPackets(): PacketSet {
  return { list: [], nextId: 1 }
}

/** The packet's label, such as "Pigeon Tax, Park: 7". */
export function packetLabel(packet: Packet): string {
  return `${CAUSE_LABEL[packet.cause]}, ${STRETCH_LABEL[packet.stretch]}: ${packet.beans}`
}

/** The two halves of a packet's label, for a card with two lines. */
export function packetLines(packet: Packet): [string, string] {
  return [
    CAUSE_LABEL[packet.cause],
    `${STRETCH_LABEL[packet.stretch]}: ${packet.beans}`
  ]
}

/**
 * Records `n` beans lost for good: they top up the newest open packet of the same cause
 * and stretch, then fill new packets of up to PACKET_SIZE. The ledger move is the
 * caller's; `loseBeans` does both.
 */
export function fillPackets(
  set: PacketSet,
  cause: LossCause,
  stretch: StretchId,
  n: number
): void {
  let left = n
  for (let i = set.list.length - 1; i >= 0 && left > 0; i--) {
    const packet = set.list[i]!
    if (packet.cause !== cause || packet.stretch !== stretch) continue
    if (packet.beans < PACKET_SIZE) {
      const add = Math.min(left, PACKET_SIZE - packet.beans)
      packet.beans += add
      left -= add
    }
    break
  }
  while (left > 0) {
    const beans = Math.min(left, PACKET_SIZE)
    set.list.push({ id: set.nextId++, cause, stretch, beans })
    left -= beans
  }
}

/** Moves `n` beans from `from` into seed packets in the ledger, and labels them by `cause`. */
export function loseBeans(
  game: Game,
  from: Place,
  n: number,
  cause: LossCause
): void {
  if (n <= 0) return
  move(game.counts, from, 'packets', n)
  recordLost(game, n, cause)
}

/**
 * Labels `n` beans that already moved to `packets` in the ledger, such as a bean the
 * Pickup world handed over when a pigeon ate it.
 */
export function recordLost(game: Game, n: number, cause: LossCause): void {
  fillPackets(game.packets, cause, currentStretch(game).id, n)
  game.stats.lost += n
  stretchLog(game).lost += n
}

/** Beans in every packet. */
export function packetBeans(set: PacketSet): number {
  let sum = 0
  for (const packet of set.list) sum += packet.beans
  return sum
}

/** Returns a problem description when packets disagree with the ledger, or null. */
export function checkPackets(counts: Counts, set: PacketSet): string | null {
  const sum = packetBeans(set)
  if (sum !== counts.packets)
    return `seed packets hold ${sum} beans but the ledger says ${counts.packets}`
  for (const packet of set.list)
    if (packet.beans < 1 || packet.beans > PACKET_SIZE)
      return `packet ${packet.id} holds ${packet.beans} beans`
  return null
}
