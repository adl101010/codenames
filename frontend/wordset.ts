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
    desc: 'Deep Undercover words, capped at 4 per board. Needs another bank checked.',
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

// The server holds a board to at most 4 mature words by swapping the
// excess for non-mature words from the same pool. That only works if
// there are non-mature words in the pool, so Mature can never be the
// only checked bank -- otherwise the board would be 25 mature words.
const REQUIRES_COMPANION = 'mature';

const KNOWN_IDS = WORD_BANKS.map((b) => b.id);

// Cleans up whatever's stored: drops unknown ids, puts the rest in
// registry order, and guarantees a legal selection (never empty, never
// Mature alone) by falling back to adding Standard.
export function normalizeBanks(selected) {
  const ids = Array.isArray(selected) ? selected : [];
  const kept = KNOWN_IDS.filter((id) => ids.indexOf(id) !== -1);
  if (!kept.some((id) => id !== REQUIRES_COMPANION)) {
    return KNOWN_IDS.filter(
      (id) => id === 'standard' || kept.indexOf(id) !== -1
    );
  }
  return kept;
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

// Whether unchecking `id` would leave an illegal selection. The last
// non-mature bank is the one that gets locked.
export function isLocked(selected, id) {
  if (selected.indexOf(id) === -1) {
    return false;
  }
  const rest = selected.filter((b) => b !== id);
  return !rest.some((b) => b !== REQUIRES_COMPANION);
}

// The selection after the user taps `id`. Unchecking the locked bank is
// a no-op rather than an error -- the checklist shows it as locked.
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
