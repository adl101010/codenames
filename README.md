# Codenames

> **Disclaimer:** My background is in infrastructure, platform, and networking, not development. Every change in this fork -- design, code, testing -- was written and implemented by [Claude Code](https://claude.com/claude-code).

Codenames is a word-guessing game. Generated boards are shareable and sync. The board can be viewed either as a clue giver or a word guesser.

This is a personal fork of [jbowens/horsepaste](https://github.com/jbowens/horsepaste), rebranded and extended for self-hosting. See [Fork changes](#fork-changes) below for everything that's different from upstream.

## How I use this at parties

Player view goes up on a TV so everyone can see the board. Both teams' clue givers sit elsewhere in the room sharing an iPad on the clue giver view and effectively run the game from there -- entering clues, locking in their team's card picks, and manually ending the turn when they're done or want to skip the bonus guess.

| Player view (TV) | Clue giver view (iPad) |
| --- | --- |
| ![Player view](player-view.png) | ![Clue giver view](cluegiver-view.png) |

A prebuilt image is published to GHCR on every push to `master` (see `.github/workflows/docker-ghcr.yml`); `docker-compose.yml` pulls `ghcr.io/adl101010/codenames:latest` directly. The image builds `linux/amd64` only.

## Fork changes

Everything below is specific to this fork; none of it exists upstream.

### Gameplay

- **Real clue-giving mechanics.** The clue giver enters a clue word and a number (1–6, or "Unlimited" for 0) through a form, confirms it before it's sent (the confirmation always shows the clue in all caps, whatever case was typed), and it's then shown to the whole team. Correct guesses up to that number don't end the turn; the team gets exactly one bonus guess past it (a "Bonus or skip?" prompt replaces the clue display once quota is hit); a wrong or neutral guess always ends the turn immediately, same as the black card ending the game outright. The clue's number circle is colored to match whichever team's turn it currently is.
- **Clue giver / player roles are enforced.** Only the clue giver can select cards or end a turn; players are view-only. The clue giver's board is tinted by team before any card is revealed; the player's board reveals a card's color only once it's actually picked, via a 3D flip animation (a bigger flip/punch/flash effect for the black card and whichever card ends the game).
- **A live-toggleable, pausable timer.** Configured from the in-game settings menu (gear icon) rather than only at game creation, so a timer can be turned on mid-game -- useful if a game starts casually and turns need to start being enforced. Includes a duration and an "enforce timer" option (auto-ends the turn on expiry vs. just visual pressure). The clue giver can also pause and resume the countdown mid-turn (a pill-shaped button next to the turn badge) -- useful for a bathroom break or a rules dispute without losing the team's remaining time.
- **Mature word filter.** The Deep Undercover word pack's NSFW-leaning words are off by default; toggling "Mature" in settings mixes them in for future games, capped at 4 mature words per board regardless of how the deck shuffles.
- **Simplified, expanded word bank.** Non-English word lists were removed (this fork is English-only); "Original" and "Deep Undercover" were merged into the two word sets that now exist (default, and Mature); Valorant (weapons/maps), CS2 (maps/callouts), and World of Warcraft (Retail specializations) words were mixed into the default set.

### Visual design

- **"Field Dossier" theme**: a vintage classified-document look (parchment texture, redacted-stamp accents, monospace/serif pairing) replacing the original UI, applied throughout the lobby, board, and settings.
- Player/clue-giver switch redesigned as a physical-style slide toggle (was two separate buttons).
- The clue giver's clue-entry form (and the given clue once submitted) is centered on the same axis as the turn badge above it, and sized up so it's easy to read and hit on a touchscreen.
- Next Game button always asks for confirmation before resetting the board; that confirmation and the clue-giving confirmation are both sized generously for touchscreen use (this is built around an iPad-passed-around-the-table setup -- see below).
- Full-screen (hides the top bar, enlarges the board) is on by default for anyone who hasn't explicitly turned it off.
- Assorted contrast/legibility fixes: revealed blue tiles lightened slightly so black text stays readable against them, timer and settings ON/OFF text reinforced to actually render bold (the monospace font's "bold" weight was barely distinguishable from regular), turn badge centering, settings menu rows aligned and spaced out.

### Hosting / ops

- Rebranded from "horsepaste" to "Codenames" throughout; removed an embedded political message, a vanity game-ID list tied to it, an undisclosed axios beacon call to a third-party domain that fired on every page load, and the upstream project's Google Analytics snippet. No code in this fork calls out to any third-party service -- it's fully local/standalone.
- `docker-compose.yml` added for deployment via [Dockge](https://github.com/louislam/dockge).
- CI publishes to GHCR on every push to `master`; builds are `linux/amd64` only (arm64 support was dropped -- this fork doesn't need it, and it was slowing every build down under QEMU emulation).
- The index page sends `Cache-Control: no-store`, so a CDN/tunnel (e.g. Cloudflare Tunnel) sitting in front of the deployment can't serve a stale cached copy of the page after a new image is deployed, or keep serving a cached copy at all once the container's stopped.
