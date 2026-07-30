import * as React from 'react';
import axios from 'axios';
import { Settings, SettingsButton, SettingsPanel } from '~/ui/settings';
import Timer from '~/ui/timer';
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
            stateToUpdate.cluegiver = false;
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
        this.setState({ game: data });
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
        this.setState({ game: data });
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
        this.setState({ game: data, cluegiver: false, confirmNextGame: false });
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
        />
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
        <div id="infoContent">
          {shareLink}
          {timer}
        </div>
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
          <div id="status" className="status-text">
            {status}
          </div>
          {endTurnButton}
        </div>
        <div className={'board ' + statusClass}>
          {this.state.game.words.map((w, idx) => (
            <div
              key={idx}
              className={
                'cell ' +
                this.state.game.layout[idx] +
                ' ' +
                (!this.state.cluegiver ? 'disabled ' : '') +
                (this.state.game.revealed[idx] ? 'revealed' : 'hidden-word')
              }
              onClick={(e) => this.guess(e, idx, w)}
            >
              <span
                className="word"
                role="button"
                aria-disabled={this.cellDisabled(idx)}
                aria-label={this.getCellAriaLabel(idx)}
              >
                {w}
              </span>
            </div>
          ))}
        </div>
        <div id="mode-toggle">
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
