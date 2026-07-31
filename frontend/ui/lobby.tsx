import * as React from 'react';
import axios from 'axios';
import { Settings } from '~/ui/settings';
import { computeWordSet } from '~/wordset';

export const Lobby = ({ defaultGameID }) => {
  const [newGameName, setNewGameName] = React.useState(defaultGameID);

  function handleNewGame(e) {
    e.preventDefault();
    if (!newGameName) {
      return;
    }

    // Timer is off by default for every new game -- it's turned on (and
    // configured) from the in-game settings menu instead, so it can also
    // be toggled mid-game rather than only at creation time. See
    // Game.setTimerOptions in game.tsx.
    axios
      .post('/next-game', {
        game_id: newGameName,
        word_set: computeWordSet(Settings.load()),
        create_new: false,
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
        </form>
      </div>
    </div>
  );
};
