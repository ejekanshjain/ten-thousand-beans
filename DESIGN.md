# 10,000 Beans: Design

A meme game that takes an idiom literally. It is built to make you angry, keep you busy with chores, and take 1 to 2 hours to finish. Unskilled players take longer.

## Decisions So Far

- **Platform:** one web game built with React and Vite. It runs in desktop browsers and phone browsers. There is no app store version.
- **Length:** 1 to 2 hours for an average player, in one sitting. Unskilled players take longer.
- **Waits:** every wait runs in real time, lasts about 1 minute, and can't be skipped. Each wait overlaps with a chore, so you never stare at a timer.
- **No paid skips:** the pain is the joke. Selling shortcuts would turn it into a cash grab.
- **Money:** free. No ads, no tip jar, no purchases.
- **No server:** no accounts, no leaderboards, no public counters. Everything runs in the browser.
- **No saving:** progress lives only while the tab is open. Closing or reloading the tab starts the game over.
- **Art style:** hand-drawn, scrappy meme look.
- **Physics:** Matter.js.

## Research Summary

- The Needle In A Haystack Simulator clip passed 50 million views in August 2026. More than 10 copies reached Steam within weeks.
- Every viral idiom game so far is on PC. This idea does not exist as a game yet.
- Copies arrive within days, so ship fast and lead with the funniest fail clip.

---

## The Game

**Pitch:** "Carry 10,000 beans across town. Pick up every one you spill."

**Working title:** 10,000 Beans. Hasbro owns "Don't Spill the Beans", and a Steam game already uses "Spill the Beans".

**Story:** Grandma's family stew needs exactly 10,000 beans. She counts every one at the door.

### Goal

- Carry a pot filled to the brim with exactly 10,000 beans from your kitchen to Grandma's door.
- You can't leave a stretch of the route until you pick up every bean you spilled there.
- Beans lost for good must be regrown before the final count.

### Route

1. **Your kitchen:** the cat sits by the door.
2. **The street:** nosy neighbours bump you and ask what's in the pot.
3. **The market:** crowds, stalls and a man with a ladder.
4. **The park:** a kid with a football, off-lead dogs and pigeons.
5. **The hill:** spilled beans roll downhill to the start of the hill.
6. **The rope bridge:** it sways, and beans that fall into the river are lost for good.
7. **Grandma's door:** her small dog jumps at you on the last step.

### Core Loop

1. Walk, and keep the pot level.
2. Spill.
3. Set the pot down and pick up every bean with tweezers.
4. Guard the pot while it sits on the ground. Pigeons come for it.
5. Walk on.

### Picking Up Beans

- Pinch or drag each bean back into the pot, one at a time.
- Beans in puddles swell and must dry in the sun for 1 minute before they fit.
- Beans in drains must be fished out with a bent coat hanger.

### Regrowing Lost Beans

- Every bean lost for good comes back as a seed packet.
- Plant it in a window box: dig, plant, water.
- It grows in 1 minute, in real time.
- A bigger window box grows more beans at once.

### Gossip Twist

Spilled beans land spelling out town gossip, for example "THE MAYOR WEARS A WIG". Collect each piece and sell it to the town newspaper for coins. Collecting all of it reveals Grandma's own secret at the end.

### Things That Go Wrong

- Potholes, cobblestones, kerbs and stairs.
- Wind on the hill and the bridge.
- Rain slowly overfills the pot.
- A cyclist rings their bell right behind you.

### Coins

- Bonus coins for each stretch of the route finished with no spills.
- Gossip pages sold to the newspaper.

### Upgrades

| Upgrade | Helps | New chore |
|---|---|---|
| Pot lid | Stops big spills | Rattles, and beans hop out on bumps |
| Grippy shoes | Less slipping | Clean the mud off after the park |
| Wider tweezers | Pick faster | Drop beans more often |
| Taller pot | Sloshes less | Tips over more |
| Pigeon net | Protects the pot | Untangle it before each use |
| Bigger window box | Regrow more beans at once | More watering |

### Length

- Each of the 7 stretches takes about 10 to 15 minutes, including picking up spills.
- Regrowing lost beans adds 1-minute waits, shared across the whole window box.
- Target: 1 to 2 hours for an average player. Unskilled players take longer.

### Ending

Grandma counts all 10,000 beans out loud. She stops at 9,999. One bean is missing. You find it under her doormat. She puts it in the stew, takes one taste, and adds salt.

### Shareable Moments

- The whole pot tipping over on Grandma's doorstep.
- A "beans picked up" count on the share card.
- The funniest gossip spelled out in beans.

### Controls

| Action | Phone | Desktop |
|---|---|---|
| Walk | Hold a thumb down; faster means more slosh | Hold W or the up arrow |
| Keep the pot level | Tilt the phone | A and D keys |
| Pick up a bean | Pinch with two fingers | Click and drag |
| Plant and water | Tap and hold | Click and hold |

### Build Notes

- Beans inside the pot are a number, not physics objects.
- Only spilled beans become physics objects, capped at about 200 on screen. Bigger spills form a pile you clear in scoops.
- Small physics bodies on a canvas run well on mid-range phones at this count.

---

## Shared Foundation

The game builds on these blocks in `src/shared`.

- **Real-time timers:** each timer stores its finish time, so it stays accurate when the tab sits in the background.
- **Chores:** one system for "this must be done before that".
- **Coins and upgrades:** one shop, one upgrade list per game.
- **No saving:** progress exists only while the tab is open.
- **Keep the screen awake:** the game asks the phone not to sleep while you play, so the screen doesn't lock mid-task.
- **Leave warning:** on desktop, closing the tab asks "Leave and lose everything?". Phone browsers don't reliably show this prompt.
- **Fail replays:** keep the last few seconds of play and replay them in slow motion.
- **Share cards:** an image with the fail and the numbers, shared through the phone's share menu.
- **Controls:** one layer that turns touch, tilt, mouse and keyboard into the same game actions.
- **Settings:** sound, sensitivity and Assist Mode.
- **Layout:** React handles menus and the shop. A canvas draws the game itself.
- **Physics:** Matter.js handles spilled beans and falling objects.
- **Scrappy look:** lines are drawn with a slight random wobble, like a felt-tip pen, so no art library is needed. Characters and props are hand-drawn images.
