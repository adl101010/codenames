import * as React from 'react';
import Toggle from '~/ui/toggle';

interface ToggleSetProps {
  toggle: {
    name: string;
    setting: string;
    desc: string;
  };
  values: any;
  handleToggle: any;
  // Greys the row out without disabling it -- for a setting that's
  // currently moot (e.g. Mature while the Holiday bank is selected) but
  // should still be visible, and still remembered if switched.
  dimmed?: boolean;
}

const ToggleSet: React.FunctionalComponent<ToggleSetProps> = ({
  toggle,
  values,
  handleToggle,
  dimmed,
}) => {
  return (
    <div
      className={'toggle-set' + (dimmed ? ' dimmed' : '')}
      key={toggle.setting}
    >
      <div className="settings-label">
        {toggle.name}{' '}
        <span className={'toggle-state'}>
          {values[toggle.setting] ? 'ON' : 'OFF'}
        </span>
        <div className="settings-desc">{toggle.desc}</div>
      </div>
      <Toggle
        name={toggle.name}
        state={values[toggle.setting]}
        handleToggle={(e) => handleToggle(e, toggle.setting)}
      />
    </div>
  );
};

export default ToggleSet;
