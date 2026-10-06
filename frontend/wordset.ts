import OriginalWords from '~/words.json';

// The word banks a game can be dealt from, picked as a checklist in the
// settings menu. The next game's pool is the union of every checked bank
// (words that appear in more than one are only dealt once -- the server
// dedupes). `id` is what's stored in settings; adding a bank means
// adding it here and a matching key in words.json.
export const WORD_BANKS = [
  {
    id: 'standard',
    name: 'Standard',
    desc: 'Everyday words, plus Valorant, CS2, and WoW.',
    words: OriginalWords['English'],
  },
  {
    id: 'mature',
    name: 'Mature',
    // Mixed with another bank the server caps it at 4 mature words per
    // board (see capMatureWords in game.go). With nothing to swap in
    // there's nothing to cap, so on its own every word is mature -- say so
    // up front rather than let it be a surprise on the TV.
    desc: 'Deep Undercover words. Capped at 4 per board when mixed with another bank; on its own, every word is mature.',
    words: OriginalWords['English (Mature)'],
  },
  {
    id: 'holiday',
    name: 'Holiday',
    desc: 'Christmas and winter holiday words.',
    words: OriginalWords['Holiday'],
  },
];

export const DEFAULT_WORD_BANKS = ['standard'];

const KNOWN_IDS = WORD_BANKS.map((b) => b.id);

// Cleans up whatever's stored: drops unknown ids and puts the rest in
// registry order. The one rule is that a game needs at least one bank to
// deal from, so an empty (or entirely unrecognised) selection falls back
// to Standard.
export function normalizeBanks(selected) {
  const ids = Array.isArray(selected) ? selected : [];
  const kept = KNOWN_IDS.filter((id) => ids.indexOf(id) !== -1);
  return kept.length ? kept : DEFAULT_WORD_BANKS.slice();
}

// Settings saved before the checklist existed stored two separate
// things: `wordBank` ('standard' | 'holiday', exclusive) and a
// `matureWords` toggle that only ever applied to Standard. Carry those
// over so nobody's choice silently resets.
export function banksFromStored(stored) {
  if (stored && Array.isArray(stored.wordBanks)) {
    return normalizeBanks(stored.wordBanks);
  }
  if (stored && stored.wordBank === 'holiday') {
    return ['holiday'];
  }
  return normalizeBanks(
    stored && stored.matureWords ? ['standard', 'mature'] : ['standard']
  );
}

// Whether unchecking `id` would leave nothing selected -- i.e. it's the
// only bank checked, which the checklist shows as locked.
export function isLocked(selected, id) {
  return selected.length === 1 && selected[0] === id;
}

// The selection after the user taps `id`. Unchecking the only checked
// bank is a no-op rather than an error -- the checklist shows it as
// locked.
export function toggleBank(selected, id) {
  if (isLocked(selected, id)) {
    return selected;
  }
  const next =
    selected.indexOf(id) === -1
      ? selected.concat([id])
      : selected.filter((b) => b !== id);
  return normalizeBanks(next);
}

// The pool the next game is dealt from: every checked bank, combined.
export function computeWordSet(settings) {
  const checked = normalizeBanks(settings && settings.wordBanks);
  const pool = [];
  const seen = {};
  WORD_BANKS.filter((b) => checked.indexOf(b.id) !== -1).forEach((bank) => {
    (bank.words || []).forEach((w) => {
      if (!seen[w]) {
        seen[w] = true;
        pool.push(w);
      }
    });
  });
  return pool;
}
