package codenames

import (
	"testing"
	"time"
)

// makeTimerTestGame builds on makeClueTestGame with a timer actually
// enabled (TimerDurationMS > 0) and a RoundStartedAt set, since
// makeClueTestGame leaves both zero -- fine for clue tests, but pause/
// resume specifically need a timer to pause and a start time to shift.
func makeTimerTestGame(startingTeam Team) *Game {
	g := makeClueTestGame(startingTeam)
	g.GameOptions = GameOptions{TimerDurationMS: 5 * 60 * 1000}
	g.RoundStartedAt = time.Now()
	return g
}

func TestPauseTimerBasic(t *testing.T) {
	g := makeTimerTestGame(Red)
	if err := g.PauseTimer(); err != nil {
		t.Fatalf("PauseTimer: %s", err)
	}
	if !g.TimerPaused {
		t.Error("TimerPaused should be true after PauseTimer")
	}
}

func TestPauseTimerRejectsWhenTimerNotEnabled(t *testing.T) {
	g := makeClueTestGame(Red) // TimerDurationMS defaults to 0 (off)
	if err := g.PauseTimer(); err == nil {
		t.Error("PauseTimer should reject a game with no timer enabled")
	}
}

func TestPauseTimerRejectsDoublePause(t *testing.T) {
	g := makeTimerTestGame(Red)
	if err := g.PauseTimer(); err != nil {
		t.Fatalf("first PauseTimer: %s", err)
	}
	if err := g.PauseTimer(); err == nil {
		t.Error("pausing an already-paused timer should be rejected")
	}
}

func TestPauseTimerRejectsAfterGameOver(t *testing.T) {
	g := makeTimerTestGame(Red)
	winner := Red
	g.WinningTeam = &winner
	if err := g.PauseTimer(); err == nil {
		t.Error("PauseTimer should reject a finished game")
	}
}

func TestResumeTimerRejectsWhenNotPaused(t *testing.T) {
	g := makeTimerTestGame(Red)
	if err := g.ResumeTimer(); err == nil {
		t.Error("ResumeTimer should reject a timer that isn't paused")
	}
}

func TestResumeTimerRejectsAfterGameOver(t *testing.T) {
	g := makeTimerTestGame(Red)
	if err := g.PauseTimer(); err != nil {
		t.Fatalf("PauseTimer: %s", err)
	}
	winner := Red
	g.WinningTeam = &winner
	if err := g.ResumeTimer(); err == nil {
		t.Error("ResumeTimer should reject a finished game")
	}
}

// TestResumeTimerShiftsRoundStartedAt is the core correctness check: the
// remaining time at the moment of pausing should be exactly what's left
// after resuming, no matter how long the timer sat paused in the
// meantime. Implemented by shifting RoundStartedAt forward by the paused
// duration rather than tracking a separate "remaining time" number, so
// this test manipulates the unexported pausedAt directly (same package)
// to simulate a pause that lasted a known, fixed duration -- sleeping in
// a test for real would be both slow and flaky.
func TestResumeTimerShiftsRoundStartedAt(t *testing.T) {
	g := makeTimerTestGame(Red)
	originalStart := g.RoundStartedAt

	if err := g.PauseTimer(); err != nil {
		t.Fatalf("PauseTimer: %s", err)
	}
	simulatedPauseDuration := 90 * time.Second
	g.pausedAt = time.Now().Add(-simulatedPauseDuration)

	if err := g.ResumeTimer(); err != nil {
		t.Fatalf("ResumeTimer: %s", err)
	}
	if g.TimerPaused {
		t.Error("TimerPaused should be false after ResumeTimer")
	}

	shifted := g.RoundStartedAt.Sub(originalStart)
	// Allow a little slack for the real time elapsed between setting
	// pausedAt and calling ResumeTimer in this test itself.
	if shifted < simulatedPauseDuration || shifted > simulatedPauseDuration+time.Second {
		t.Errorf("RoundStartedAt shifted by %s, want ~%s", shifted, simulatedPauseDuration)
	}
}

func TestNextTurnUnpausesTimer(t *testing.T) {
	g := makeTimerTestGame(Red)
	if err := g.PauseTimer(); err != nil {
		t.Fatalf("PauseTimer: %s", err)
	}
	if ok := g.NextTurn(0); !ok {
		t.Fatalf("NextTurn should have succeeded")
	}
	if g.TimerPaused {
		t.Error("a new turn should always start with the timer unpaused")
	}
}

func TestWrongGuessUnpausesTimer(t *testing.T) {
	g := makeTimerTestGame(Red)
	g.SetClue("ocean", 3)
	if err := g.PauseTimer(); err != nil {
		t.Fatalf("PauseTimer: %s", err)
	}
	// idx 6 is a Blue card -- wrong guess for Red, ends the turn.
	if err := g.Guess(6); err != nil {
		t.Fatalf("Guess: %s", err)
	}
	if g.TimerPaused {
		t.Error("a turn-ending wrong guess should unpause the timer for the next turn")
	}
}

func TestSetOptionsUnpausesTimer(t *testing.T) {
	g := makeTimerTestGame(Red)
	if err := g.PauseTimer(); err != nil {
		t.Fatalf("PauseTimer: %s", err)
	}
	g.SetOptions(GameOptions{TimerDurationMS: 3 * 60 * 1000})
	if g.TimerPaused {
		t.Error("reconfiguring timer options should unpause it rather than leave it stuck paused")
	}
}
