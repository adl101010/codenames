import OriginalWords from '~/words.json';

// The default word bank is family-safe. The Deep Undercover pack's
// mature/NSFW-leaning words only get mixed in when the "Mature"
// setting is explicitly enabled.
export function computeWordSet(settings) {
  const words = [...OriginalWords['English']];
  if (settings && settings.matureWords) {
    words.push(...(OriginalWords['English (Mature)'] || []));
  }
  return words;
}
