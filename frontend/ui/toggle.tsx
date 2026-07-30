import * as React from 'react';

interface ToggleProps {
  name: string;
  state: boolean;
  handleToggle: any;
}

const Toggle: React.FunctionalComponent<ToggleProps> = ({
  name,
  state,
  handleToggle,
}) => {
  return (
    <div
      onClick={handleToggle}
      className={state ? 'toggle active' : 'toggle inactive'}
      role="switch"
      aria-label={name}
      aria-checked={!!state}
    >
      <div className="switch" aria-hidden="true"></div>
    </div>
  );
};

export default Toggle;
