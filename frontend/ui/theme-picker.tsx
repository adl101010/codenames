import * as React from 'react';
import { THEMES, normalizeTheme } from '~/ui/theme';

interface ThemePickerProps {
  // The game's current theme id. May be empty or unrecognised.
  theme: string;
  handleSelect: (id: string) => void;
}

// A single-choice list, laid out and sized like the word bank checklist so
// every row is a full-width tap target on the iPad. Unlike the word banks,
// this isn't a per-device preference: picking one changes the look for
// everyone at the table (see Game.setTheme), which the description says
// outright so nobody's surprised when the TV changes.
const ThemePicker: React.FunctionalComponent<ThemePickerProps> = ({
  theme,
  handleSelect,
}) => {
  const current = normalizeTheme(theme);
  const currentName = THEMES.filter((t) => t.id === current)[0].name;
  return (
    <div
      className="bank-checklist theme-picker"
      role="radiogroup"
      aria-labelledby="theme-heading"
    >
      <div className="settings-label" id="theme-heading">
        Theme <span className="toggle-state">{currentName.toUpperCase()}</span>
        <div className="settings-desc">
          Changes the look on every screen at this table, not just this one.
        </div>
      </div>
      {THEMES.map((t) => {
        const selected = t.id === current;
        return (
          <button
            type="button"
            key={t.id}
            role="radio"
            aria-checked={selected}
            className={'bank-item' + (selected ? ' checked' : '')}
            onClick={() => handleSelect(t.id)}
          >
            <span
              className={'theme-swatch swatch-' + t.id}
              aria-hidden="true"
            ></span>
            <span className="bank-text">
              <span className="bank-name">{t.name}</span>
              <span className="bank-desc">{t.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ThemePicker;
