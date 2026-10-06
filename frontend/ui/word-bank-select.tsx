import * as React from 'react';

// The word banks a game can be dealt from. `id` is what gets stored in
// settings (and what computeWordSet in ~/wordset keys off); adding a
// bank means adding it here and giving computeWordSet a branch for it.
export const wordBanks = [
  { id: 'standard', name: 'Standard' },
  { id: 'holiday', name: 'Holiday' },
];

interface WordBankSelectProps {
  value: string;
  handleSelect: (id: string) => void;
}

// A segmented control rather than an on/off Toggle, since this is a
// choice between banks, not a switch. Laid out with the same
// .toggle-set row as the settings above and below it so its label and
// its right edge line up with theirs.
const WordBankSelect: React.FunctionalComponent<WordBankSelectProps> = ({
  value,
  handleSelect,
}) => {
  const current = wordBanks.find((b) => b.id === value) || wordBanks[0];
  return (
    <div className="toggle-set">
      <div className="settings-label">
        Word bank{' '}
        <span className="toggle-state">{current.name.toUpperCase()}</span>
        <div className="settings-desc">
          Words the next game is dealt from. Doesn't change a game in progress.
        </div>
      </div>
      <div className="bank-select" role="radiogroup" aria-label="Word bank">
        {wordBanks.map((bank) => (
          <button
            type="button"
            key={bank.id}
            role="radio"
            aria-checked={bank.id === current.id}
            className={'bank-option' + (bank.id === current.id ? ' active' : '')}
            onClick={() => handleSelect(bank.id)}
          >
            {bank.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default WordBankSelect;
