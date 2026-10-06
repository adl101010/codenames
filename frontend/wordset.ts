import OriginalWords from '~/words.json';

// Which word bank the next game is dealt from, picked in the settings
// menu. Banks are exclusive -- Holiday is its own deck, not words mixed
// into the standard one (a board is only 25 of them, so mixing 75 holiday
// words into ~500 standard ones would barely show up).
export const DEFAULT_WORD_BANK = 'standard';

// The standard bank is family-safe. The Deep Undercover pack's
// mature/NSFW-leaning words only get mixed in when the "Mature"
// setting is explicitly enabled -- and only into the standard bank.
export function computeWordSet(settings) {
  if (settings && settings.wordBank === 'holiday') {
    return [...OriginalWords['Holiday']];
  }

  const words = [...OriginalWords['English']];
  if (settings && settings.matureWords) {
    words.push(...(OriginalWords['English (Mature)'] || []));
  }
  return words;
}
