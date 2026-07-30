import * as React from 'react';
import axios from 'axios';
import TimerSettings from '~/ui/timer_settings';
import { Settings } from '~/ui/settings';
import { computeWordSet } from '~/wordset';

export const Lobby = ({ defaultGameID }) => {
  const [newGameName, setNewGameName] = React.useState(defaultGameID);
  const [timer, setTimer] = React.useState(null);
  const [enforceTimerEnabled, setEnforceTimerEnabled] = React.useState(false);

  function handleNewGame(e) {
    e.preventDefault();
    if (!newGameName) {
      return;
    }

    axios
      .post('/next-game', {
        game_id: newGameName,
        word_set: computeWordSet(Settings.load()),
        create_new: false,
        timer_duration_ms:
          timer && timer.length ? timer[0] * 60 * 1000 + timer[1] * 1000 : 0,
        enforce_timer: timer && timer.length && enforceTimerEnabled,
      })
      .then(() => {
        const newURL = (document.location.pathname = '/' + newGameName);
        window.location = newURL;
      });
  }

  return (
    <div id="lobby">
      <div id="available-games">
        <form id="new-game">
          <p className="intro">
            Play Codenames online across multiple devices on a shared board. To
            create a new game or join an existing game, enter a game identifier
            and click 'GO'.
          </p>
          <input
            type="text"
            id="game-name"
            aria-label="game identifier"
            autoFocus
            onChange={(e) => {
              setNewGameName(e.target.value);
            }}
            value={newGameName}
          />

          <button disabled={!newGameName.length} onClick={handleNewGame}>
            Go
          </button>

          <TimerSettings
            {...{
              timer,
              setTimer,
              enforceTimerEnabled,
              setEnforceTimerEnabled,
            }}
          />
        </form>
      </div>
    </div>
  );
};
