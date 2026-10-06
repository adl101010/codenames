import * as React from 'react';
import { WORD_BANKS, isLocked } from '~/wordset';

interface WordBankChecklistProps {
  // Ids of the checked banks (already normalized -- see normalizeBanks).
  selected: string[];
  // Total size of the combined pool, shown next to the heading.
  poolSize: number;
  handleToggle: (id: string) => void;
}

// A checklist rather than a switch or a single-choice picker: the next
// game is dealt from every checked bank combined. Each row is one big
// button (role="checkbox") so the whole thing is a generous tap target
// on the iPad, not just the little box.
const WordBankChecklist: React.FunctionalComponent<WordBankChecklistProps> = ({
  selected,
  poolSize,
  handleToggle,
}) => {
  return (
    <div className="bank-checklist" role="group" aria-labelledby="bank-heading">
      <div className="settings-label" id="bank-heading">
        Word banks <span className="toggle-state">{poolSize} WORDS</span>
        <div className="settings-desc">
          Words the next game is dealt from. Doesn't change a game in progress.
        </div>
      </div>
      {WORD_BANKS.map((bank) => {
        const checked = selected.indexOf(bank.id) !== -1;
        // The last non-mature bank can't be unchecked -- see wordset.ts.
        const locked = isLocked(selected, bank.id);
        return (
          <button
            type="button"
            key={bank.id}
            role="checkbox"
            aria-checked={checked}
            aria-disabled={locked}
            title={locked ? 'Keep at least one bank checked' : undefined}
            className={
              'bank-item' + (checked ? ' checked' : '') + (locked ? ' locked' : '')
            }
            onClick={() => handleToggle(bank.id)}
          >
            <span className="bank-box" aria-hidden="true"></span>
            <span className="bank-text">
              <span className="bank-name">
                {bank.name}
                <span className="bank-count">{bank.words.length} words</span>
              </span>
              <span className="bank-desc">{bank.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default WordBankChecklist;
