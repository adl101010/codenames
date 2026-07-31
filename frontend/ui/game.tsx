import * as React from 'react';
import axios from 'axios';
import { Settings, SettingsButton, SettingsPanel } from '~/ui/settings';
import Timer from '~/ui/timer';
import TimerSettings from '~/ui/timer_settings';
import { computeWordSet } from '~/wordset';

const defaultFavicon =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAA8SURBVHgB7dHBDQAgCAPA1oVkBWdzPR84kW4AD0LCg36bXJqUcLL2eVY/EEwDFQBeEfPnqUpkLmigAvABK38Grs5TfaMAAAAASUVORK5CYII=';
const blueTurnFavicon =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAmSURBVHgB7cxBAQAABATBo5ls6ulEiPt47ASYqJ6VIWUiICD4Ehyi7wKv/xtOewAAAABJRU5ErkJggg==';
const redTurnFavicon =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAmSURBVHgB7cwxAQAACMOwgaL5d4EiELGHoxGQGnsVaIUICAi+BAci2gJQFUhklQAAAABJRU5ErkJggg==';
export class Game extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      game: null,
      mounted: true,
      settings: Settings.load(),
      mode: 'game',
      cluegiver: false,
      confirmNextGame: false,
      clueText: '',
      clueNumberInput: 1,
      confirmClue: false,
      // Maps a board index to which reveal animation it should play in
      // player view: 'flip-a' for a normal reveal, 'flip-ab' for the
      // black card or the card that ends the game. Populated once, the
      // instant a card is detected transitioning from hidden to
      // revealed -- see computeRevealAnimationUpdates.
      revealAnimations: {},
    };
  }

  public extraClasses() {
    var classes = '';
    if (this.state.settings.fullscreen) {
      classes += ' full-screen';
    }
    return classes;
  }

  public handleKeyDown(e) {
    if (e.keyCode == 27) {
      this.setState({ mode: 'game' });
    }
  }

  public componentDidMount(prevProps, prevState) {
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.setTurnIndicatorFavicon(prevProps, prevState);
    this.refresh();
  }

  public componentWillUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.getElementById('favicon').setAttribute('href', defaultFavicon);
    this.setState({ mounted: false });
  }

  public componentDidUpdate(prevProps, prevState) {
    this.setTurnIndicatorFavicon(prevProps, prevState);
  }

  // Diffs an old and new game to find cards that just flipped from hidden
  // to revealed -- whether from this browser's own click or picked up from
  // another device on the next poll -- and returns which reveal animation
  // each one should play, or null if nothing new was revealed.
  //
  // Must be called from inside the same setState updater that applies the
  // new game data (see guess() and refresh()), using the updater's own
  // "old" argument as prevGame -- not a separate componentDidUpdate pass.
  // That would diff against state from a render that already happened,
  // landing revealAnimations one tick behind game.revealed: the cell would
  // render revealed-but-unclassified first (falling back to a plain
  // flip-a), and only upgrade to flip-ab a render later, after the plain
  // flip had already started playing.
  private computeRevealAnimationUpdates(oldGame, newGame) {
    if (!oldGame || !newGame || !newGame.revealed || !oldGame.revealed) {
      return null; // nothing to diff against yet (e.g. first load)
    }
    const causedWin = !oldGame.winning_team && !!newGame.winning_team;
    let updates = null;
    for (let idx = 0; idx < newGame.revealed.length; idx++) {
      if (newGame.revealed[idx] && !oldGame.revealed[idx]) {
        const isDramatic = newGame.layout[idx] === 'black' || causedWin;
        updates = updates || {};
        updates[idx] = isDramatic ? 'flip-ab' : 'flip-a';
      }
    }
    return updates;
  }

  private setTurnIndicatorFavicon(prevProps, prevState) {
    if (
      prevState?.game?.winning_team !== this.state.game?.winning_team ||
      prevState?.game?.round !== this.state.game?.round ||
      prevState?.game?.state_id !== this.state.game?.state_id
    ) {
      if (this.state.game?.winning_team) {
        document.getElementById('favicon').setAttribute('href', defaultFavicon);
      } else {
        document
          .getElementById('favicon')
          .setAttribute(
            'href',
            this.currentTeam() === 'blue' ? blueTurnFavicon : redTurnFavicon
          );
      }
    }
  }

  /* Gets info about current score so screen readers can describe how many words
   * remain for each team. */
  private getScoreAriaLabel(startingTeam, otherTeam) {
    return (
      'Score: ' +
      this.remaining(startingTeam).toString() +
      ' ' +
      startingTeam +
      ' words remaining, ' +
      this.remaining(otherTeam).toString() +
      ' ' +
      otherTeam +
      ' words remaining'
    );
  }

  // Determines value of aria-disabled attribute to tell screen readers if word can be clicked.
  private cellDisabled(idx) {
    if (!this.state.cluegiver) {
      return true; // only the clue giver may select cards
    } else if (this.state.game.revealed[idx]) {
      return true;
    } else if (this.state.game.winning_team) {
      return true;
    }
    return false;
  }

  // Gets info about word to assist screen readers with describing cell.
  private getCellAriaLabel(idx) {
    let ariaLabel = this.state.game.words[idx].toLowerCase();
    if (
      this.state.cluegiver ||
      this.state.game.winning_team ||
      this.state.game.revealed[idx]
    ) {
      let wordColor = this.state.game.layout[idx];
      ariaLabel += ', ' + (wordColor === 'black' ? 'bomb' : wordColor);
    }
    ariaLabel +=
      ', ' + (this.state.game.revealed[idx] ? 'revealed word' : 'hidden word');
    ariaLabel += '.';
    return ariaLabel;
  }

  public refresh() {
    if (!this.state.mounted) {
      return;
    }

    let state_id = '';
    if (this.state.game && this.state.game.state_id) {
      state_id = this.state.game.state_id;
    }

    axios
      .post('/game-state', {
        game_id: this.props.gameID,
        state_id: state_id,
      })
      .then(({ data }) => {
        this.setState((oldState) => {
          const stateToUpdate = { game: data };
          if (oldState.game && data.created_at != oldState.game.created_at) {
            // A new round -- possibly started from another device -- so
            // there's nothing left worth keeping from the last one.
            stateToUpdate.cluegiver = false;
            stateToUpdate.revealAnimations = {};
          } else {
            const updates = this.computeRevealAnimationUpdates(
              oldState.game,
              data
            );
            if (updates) {
              stateToUpdate.revealAnimations = {
                ...oldState.revealAnimations,
                ...updates,
              };
            }
          }
          return stateToUpdate;
        });
      })
      .finally(() => {
        setTimeout(() => {
          this.refresh();
        }, 2000);
      });
  }

  public toggleRole(e, role) {
    e.preventDefault();
    this.setState({ cluegiver: role == 'cluegiver' });
  }

  public guess(e, idx) {
    e.preventDefault();
    if (!this.state.cluegiver) {
      return; // only the clue giver may select cards
    }
    if (this.state.game.revealed[idx]) {
      return; // ignore if already revealed
    }
    if (this.state.game.winning_team) {
      return; // ignore if game is over
    }

    axios
      .post('/guess', {
        game_id: this.state.game.id,
        index: idx,
      })
      .then(({ data }) => {
        this.setState((oldState) => {
          const stateToUpdate = { game: data };
          const updates = this.computeRevealAnimationUpdates(
            oldState.game,
            data
          );
          if (updates) {
            stateToUpdate.revealAnimations = {
              ...oldState.revealAnimations,
              ...updates,
            };
          }
          return stateToUpdate;
        });
      });
  }

  public currentTeam() {
    if (this.state.game.round % 2 == 0) {
      return this.state.game.starting_team;
    }
    return this.state.game.starting_team == 'red' ? 'blue' : 'red';
  }

  public remaining(color) {
    var count = 0;
    for (var i = 0; i < this.state.game.revealed.length; i++) {
      if (this.state.game.revealed[i]) {
        continue;
      }
      if (this.state.game.layout[i] == color) {
        count++;
      }
    }
    return count;
  }

  public endTurn() {
    axios
      .post('/end-turn', {
        game_id: this.state.game.id,
        current_round: this.state.game.round,
      })
      .then(({ data }) => {
        // Clear any unsent clue draft -- the server already reset the
        // real clue for the new turn, but the local input's typed text
        // is separate state and would otherwise linger into whoever
        // gives the next clue.
        this.setState({ game: data, clueText: '', clueNumberInput: 1 });
      });
  }

  public updateClueText(e) {
    this.setState({ clueText: e.target.value });
  }

  public updateClueNumber(e) {
    this.setState({ clueNumberInput: parseInt(e.target.value, 10) });
  }

  public requestSetClue(e) {
    e.preventDefault();
    if (!this.state.clueText.trim()) {
      return;
    }
    this.setState({ confirmClue: true });
  }

  public cancelClue(e) {
    if (e != null) {
      e.preventDefault();
    }
    this.setState({ confirmClue: false });
  }

  public confirmSetClue(e) {
    e.preventDefault();
    axios
      .post('/set-clue', {
        game_id: this.state.game.id,
        clue: this.state.clueText,
        number: this.state.clueNumberInput,
      })
      .then(({ data }) => {
        this.setState({
          game: data,
          clueText: '',
          clueNumberInput: 1,
          confirmClue: false,
        });
      });
  }

  public nextGame(e) {
    e.preventDefault();
    this.setState({ confirmNextGame: true });
  }

  public cancelNextGame(e) {
    if (e != null) {
      e.preventDefault();
    }
    this.setState({ confirmNextGame: false });
  }

  public startNextGame(e) {
    e.preventDefault();
    axios
      .post('/next-game', {
        game_id: this.state.game.id,
        // Recompute rather than reusing this.state.game.word_set, so a
        // Mature toggle flipped mid-party takes effect on the very next
        // game instead of only on ones created fresh from the lobby.
        word_set: computeWordSet(this.state.settings),
        create_new: true,
        timer_duration_ms: this.state.game.timer_duration_ms,
        enforce_timer: this.state.game.enforce_timer,
      })
      .then(({ data }) => {
        this.setState({
          game: data,
          cluegiver: false,
          confirmNextGame: false,
          revealAnimations: {},
        });
      });
  }

  public toggleSettingsView(e) {
    if (e != null) {
      e.preventDefault();
    }
    if (this.state.mode == 'settings') {
      this.setState({ mode: 'game' });
    } else {
      this.setState({ mode: 'settings' });
    }
  }

  public toggleSetting(e, setting) {
    if (e != null) {
      e.preventDefault();
    }
    const vals = { ...this.state.settings };
    vals[setting] = !vals[setting];
    this.setState({ settings: vals });
    Settings.save(vals);
  }

  // Pushes a timer config change to the live game -- unlike the other
  // settings above, which are purely local preferences, the timer is
  // shared game state: it needs to reach every connected player, and
  // take effect on the current turn, not just the next one. Read
  // straight off this.state.game (rather than kept as separate local
  // state) so it always reflects what's actually live, including
  // changes made from another device's settings menu.
  public setTimerOptions(timerDurationMs, enforceTimer) {
    axios
      .post('/set-options', {
        game_id: this.state.game.id,
        timer_duration_ms: timerDurationMs,
        enforce_timer: enforceTimer,
      })
      .then(({ data }) => {
        this.setState({ game: data });
      });
  }

  // The clue/number display that sits where the timer used to (see
  // render()). Cluegiver-only clue-entry form when no clue has been given
  // yet for this turn; otherwise the active clue for both views, swapping
  // to a "Bonus or skip?" prompt once the team has matched the clue's
  // number. That prompt is purely informational -- taking the bonus is
  // just guessing another card, and skipping is just End Turn -- there
  // are no new buttons for it.
  // Shared by both roles once a clue has been given: the word + number, or
  // the "Bonus or skip?" indicator once quota is reached. Only the "no clue
  // yet" state differs between the clue giver (the input form) and players
  // (a waiting placeholder) -- see renderClueGiverArea/renderClueDisplay.
  private renderClueOrBonus() {
    const game = this.state.game;
    const bonusAvailable =
      game.clue_number > 0 && game.correct_guesses >= game.clue_number;
    if (bonusAvailable) {
      return (
        <div id="clue-display" className="bonus">
          Bonus or skip?
        </div>
      );
    }

    return (
      <div id="clue-display">
        <span className="clue-word">{game.clue}</span>
        <span className="clue-number">
          {game.clue_number === 0 ? '∞' : game.clue_number}
        </span>
      </div>
    );
  }

  // Clue giver's slot in the bottom mode-toggle row: the clue-entry form
  // until a clue's been given for the turn, then the same word/bonus
  // display players see (so the giver has a reminder of what they clued).
  private renderClueGiverArea() {
    const game = this.state.game;
    if (game.winning_team) {
      return null;
    }
    if (!game.clue) {
      return (
        <form id="clue-form" onSubmit={(e) => this.requestSetClue(e)}>
          <input
            type="text"
            id="clue-word"
            aria-label="Clue word"
            placeholder="Clue"
            maxLength={40}
            value={this.state.clueText}
            onChange={(e) => this.updateClueText(e)}
          />
          <select
            id="clue-number"
            aria-label="Clue number"
            value={this.state.clueNumberInput}
            onChange={(e) => this.updateClueNumber(e)}
          >
            {[1, 2, 3, 4, 5, 6, 0].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Unlimited' : n}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!this.state.clueText.trim()}>
            Give clue
          </button>
        </form>
      );
    }
    return this.renderClueOrBonus();
  }

  // Player's slot in the status line: a waiting placeholder before a clue
  // has been given, then the same word/bonus display the giver sees.
  private renderClueDisplay() {
    const game = this.state.game;
    if (game.winning_team) {
      return null;
    }
    if (!game.clue) {
      return (
        <div id="clue-display" className="waiting">
          Waiting for clue&hellip;
        </div>
      );
    }
    return this.renderClueOrBonus();
  }

  render() {
    if (!this.state.game) {
      return <p className="loading">Loading&hellip;</p>;
    }
    if (this.state.mode == 'settings') {
      return (
        <SettingsPanel
          toggleView={(e) => this.toggleSettingsView(e)}
          toggle={(e, setting) => this.toggleSetting(e, setting)}
          values={this.state.settings}
        >
          <TimerSettings
            timer={
              this.state.game.timer_duration_ms > 0
                ? [
                    Math.floor(this.state.game.timer_duration_ms / 60000),
                    Math.floor(
                      (this.state.game.timer_duration_ms % 60000) / 1000
                    ),
                  ]
                : null
            }
            setTimer={(newTimer) => {
              const ms = newTimer
                ? newTimer[0] * 60000 + newTimer[1] * 1000
                : 0;
              this.setTimerOptions(ms, ms > 0 && this.state.game.enforce_timer);
            }}
            enforceTimerEnabled={!!this.state.game.enforce_timer}
            setEnforceTimerEnabled={(newVal) =>
              this.setTimerOptions(this.state.game.timer_duration_ms, newVal)
            }
          />
        </SettingsPanel>
      );
    }

    let status, statusClass;
    if (this.state.game.winning_team) {
      statusClass = this.state.game.winning_team + ' win';
      status = this.state.game.winning_team + ' wins!';
    } else {
      statusClass = this.currentTeam() + '-turn';
      status = this.currentTeam() + "'s turn";
    }

    let endTurnButton;
    if (!this.state.game.winning_team && this.state.cluegiver) {
      endTurnButton = (
        <div id="end-turn-cont">
          <button
            onClick={(e) => this.endTurn(e)}
            id="end-turn-btn"
            aria-label={'End ' + this.currentTeam() + "'s turn"}
          >
            End {this.currentTeam()}&#39;s turn
          </button>
        </div>
      );
    }

    let shareLink = null;
    if (!this.state.settings.fullscreen) {
      shareLink = (
        <div id="share">
          Send this link to friends:&nbsp;
          <a className="url" href={window.location.href}>
            {window.location.href}
          </a>
        </div>
      );
    }

    const timer = !!this.state.game.timer_duration_ms && (
      <div id="timer">
        <Timer
          roundStartedAt={this.state.game.round_started_at}
          timerDurationMs={this.state.game.timer_duration_ms}
          handleExpiration={() => {
            this.state.game.enforce_timer && this.endTurn();
          }}
          freezeTimer={!!this.state.game.winning_team}
        />
      </div>
    );

    return (
      <div
        id="game-view"
        className={
          (this.state.cluegiver ? 'cluegiver' : 'player') +
          this.extraClasses()
        }
      >
        {shareLink && <div id="infoContent">{shareLink}</div>}
        <div id="status-line" className={statusClass}>
          <div
            id="remaining"
            role="img"
            aria-label={this.getScoreAriaLabel('red', 'blue')}
          >
            <span className="team-tally red-tally">
              <span className="team-dot" aria-hidden="true"></span>
              <span className="team-label">Red</span>
              <span className="team-count">{this.remaining('red')}</span>
            </span>
            <span className="team-tally blue-tally">
              <span className="team-dot" aria-hidden="true"></span>
              <span className="team-label">Blue</span>
              <span className="team-count">{this.remaining('blue')}</span>
            </span>
          </div>
          <div className="status-col">
            <div id="status" className="status-text">
              {status}
            </div>
            {timer}
          </div>
          {endTurnButton}
          {!this.state.cluegiver && this.renderClueDisplay()}
        </div>
        <div className={'board ' + statusClass}>
          {this.state.game.words.map((w, idx) => {
            const revealed = this.state.game.revealed[idx];
            const baseClassName =
              'cell ' +
              this.state.game.layout[idx] +
              ' ' +
              (!this.state.cluegiver ? 'disabled ' : '') +
              (revealed ? 'revealed' : 'hidden-word');

            const wordSpan = (
              <span
                className="word"
                role="button"
                aria-disabled={this.cellDisabled(idx)}
                aria-label={this.getCellAriaLabel(idx)}
              >
                {w}
              </span>
            );

            // Clue giver view is already team-tinted before a card is
            // revealed (see game.css), so there's nothing to "discover" --
            // keep it as a plain, instant swap. The animated flip is a
            // player-view-only flourish, since players are the ones
            // actually watching a card get chosen in real time.
            if (this.state.cluegiver) {
              return (
                <div
                  key={idx}
                  className={baseClassName}
                  onClick={(e) => this.guess(e, idx, w)}
                >
                  {wordSpan}
                </div>
              );
            }

            // "flip" is present whether or not the card is revealed yet --
            // it's what tells the CSS to render this as a two-face card
            // instead of the flat cluegiver look. "flip-a"/"flip-ab" plus
            // "go" only apply once revealed, and pick + trigger the
            // specific reveal animation.
            const animClass = revealed
              ? (this.state.revealAnimations[idx] || 'flip-a') + ' go'
              : '';

            return (
              <div
                key={idx}
                className={baseClassName + ' flip ' + animClass}
                onClick={(e) => this.guess(e, idx, w)}
              >
                <div className="face-wrap">
                  {/* Codenames players see every word at all times -- only
                      the color underneath is secret until revealed. The
                      back face still needs the word, just without color/
                      team info, matching what "hidden-word" cells always
                      showed before this flip structure existed. It's
                      aria-hidden because the front face's word span
                      already reports the correct accessible state
                      (hidden vs. revealed) regardless of which face is
                      visually facing forward. */}
                  <div className="face back">
                    <span className="word" aria-hidden="true">
                      {w}
                    </span>
                  </div>
                  <div className="face front">{wordSpan}</div>
                </div>
                <div className="flash" aria-hidden="true"></div>
              </div>
            );
          })}
        </div>
        <div id="mode-toggle-clue">
          {this.state.cluegiver && this.renderClueGiverArea()}
        </div>
        <div id="mode-toggle">
          <div id="mode-toggle-right">
            <SettingsButton
              onClick={(e) => {
                this.toggleSettingsView(e);
              }}
            />
            <button
              type="button"
              className={
                'role-switch ' + (this.state.cluegiver ? 'cluegiver' : 'player')
              }
              role="switch"
              aria-checked={this.state.cluegiver}
              aria-label="Switch between player and clue giver view"
              onClick={(e) =>
                this.toggleRole(e, this.state.cluegiver ? 'player' : 'cluegiver')
              }
            >
              <span className="switch-knob" aria-hidden="true"></span>
              <span className="switch-label player-label">Player</span>
              <span className="switch-label cluegiver-label">Clue giver</span>
            </button>
            <button onClick={(e) => this.nextGame(e)} id="next-game-btn">
              Next game
            </button>
          </div>
        </div>
        {this.state.confirmClue && (
          <div className="confirm-overlay">
            <div className="confirm-dialog">
              <p className="confirm-message">
                Give the clue &ldquo;{this.state.clueText}&rdquo; for{' '}
                {this.state.clueNumberInput === 0
                  ? 'unlimited'
                  : this.state.clueNumberInput}
                ?
              </p>
              <div className="confirm-actions">
                <button onClick={(e) => this.cancelClue(e)}>Cancel</button>
                <button
                  className="confirm-yes"
                  onClick={(e) => this.confirmSetClue(e)}
                >
                  Give clue
                </button>
              </div>
            </div>
          </div>
        )}
        {this.state.confirmNextGame && (
          <div className="confirm-overlay">
            <div className="confirm-dialog">
              <p className="confirm-message">
                Start a new game? This resets the board for everyone.
              </p>
              <div className="confirm-actions">
                <button onClick={(e) => this.cancelNextGame(e)}>Cancel</button>
                <button
                  className="confirm-yes"
                  onClick={(e) => this.startNextGame(e)}
                >
                  New game
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}
