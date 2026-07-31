package codenames

import (
	"strings"
	"testing"
	"time"
)

// makeClueTestGame builds a Game with full manual control over the layout,
// bypassing newGame's random shuffling so tests can guess specific known
// colors at specific indices.
//
// Red gets 6 cards (idx 0-5), deliberately more than any single test
// guesses correctly, so a run of correct guesses never accidentally
// reveals Red's last card and triggers a real win -- that's covered
// deliberately by TestGuessWinningLastCardIgnoresQuota instead, and letting
// it happen by accident in an unrelated test would silently short-circuit
// the guess (see Guess()'s early return once WinningTeam is set) and make
// that test's assertions meaningless rather than failing loudly.
func makeClueTestGame(startingTeam Team) *Game {
	layout := make([]Team, wordsPerGame)
	words := make([]string, wordsPerGame)
	for i := range layout {
		words[i] = "WORD"
	}
	// idx 0-5: Red, 6-9: Blue, 10: Black, 11-24: Neutral.
	for i := 0; i <= 5; i++ {
		layout[i] = Red
	}
	for i := 6; i <= 9; i++ {
		layout[i] = Blue
	}
	layout[10] = Black
	for i := 11; i < wordsPerGame; i++ {
		layout[i] = Neutral
	}
	return &Game{
		ID:           "test",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		StartingTeam: startingTeam,
		Words:        words,
		Layout:       layout,
		GameState: GameState{
			Revealed: make([]bool, wordsPerGame),
		},
	}
}

func TestSetClueBasic(t *testing.T) {
	g := makeClueTestGame(Red)
	if err := g.SetClue("ocean", 3); err != nil {
		t.Fatalf("SetClue: %s", err)
	}
	if g.Clue != "ocean" {
		t.Errorf("Clue = %q, want %q", g.Clue, "ocean")
	}
	if g.ClueNumber != 3 {
		t.Errorf("ClueNumber = %d, want 3", g.ClueNumber)
	}
	if g.CorrectGuesses != 0 {
		t.Errorf("CorrectGuesses = %d, want 0", g.CorrectGuesses)
	}
}

func TestSetClueTrimsWhitespace(t *testing.T) {
	g := makeClueTestGame(Red)
	if err := g.SetClue("  ocean  ", 3); err != nil {
		t.Fatalf("SetClue: %s", err)
	}
	if g.Clue != "ocean" {
		t.Errorf("Clue = %q, want trimmed %q", g.Clue, "ocean")
	}
}

func TestSetClueRejectsEmpty(t *testing.T) {
	g := makeClueTestGame(Red)
	if err := g.SetClue("", 3); err == nil {
		t.Error("SetClue(\"\", 3) should have failed")
	}
	if err := g.SetClue("   ", 3); err == nil {
		t.Error("SetClue(whitespace-only, 3) should have failed")
	}
	if g.Clue != "" {
		t.Errorf("Clue should remain unset after rejected calls, got %q", g.Clue)
	}
}

func TestSetClueRejectsOutOfRangeNumber(t *testing.T) {
	for _, n := range []int{-1, 7, 100} {
		g := makeClueTestGame(Red)
		if err := g.SetClue("ocean", n); err == nil {
			t.Errorf("SetClue(\"ocean\", %d) should have failed", n)
		}
	}
}

func TestSetClueAllowsZeroForUnlimited(t *testing.T) {
	g := makeClueTestGame(Red)
	if err := g.SetClue("ocean", 0); err != nil {
		t.Fatalf("SetClue with number=0 should be allowed: %s", err)
	}
	if g.ClueNumber != 0 {
		t.Errorf("ClueNumber = %d, want 0", g.ClueNumber)
	}
}

func TestSetClueRejectsOverlong(t *testing.T) {
	g := makeClueTestGame(Red)
	longClue := strings.Repeat("a", 101)
	if err := g.SetClue(longClue, 3); err == nil {
		t.Error("SetClue with a 101-char clue should have failed")
	}
	exactly100 := strings.Repeat("a", 100)
	if err := g.SetClue(exactly100, 3); err != nil {
		t.Errorf("SetClue with an exactly-100-char clue should be allowed: %s", err)
	}
}

func TestSetClueRejectsSecondClueSameTurn(t *testing.T) {
	g := makeClueTestGame(Red)
	if err := g.SetClue("ocean", 3); err != nil {
		t.Fatalf("first SetClue: %s", err)
	}
	if err := g.SetClue("river", 2); err == nil {
		t.Error("a second SetClue in the same turn should have failed")
	}
	if g.Clue != "ocean" || g.ClueNumber != 3 {
		t.Errorf("clue should be unchanged by the rejected second call, got %q/%d",
			g.Clue, g.ClueNumber)
	}
}

func TestSetClueRejectsAfterGameOver(t *testing.T) {
	g := makeClueTestGame(Red)
	winner := Red
	g.WinningTeam = &winner
	if err := g.SetClue("ocean", 3); err == nil {
		t.Error("SetClue after the game is won should have failed")
	}
}

func TestGuessWrongTeamEndsTurnAndClearsClue(t *testing.T) {
	g := makeClueTestGame(Red) // Round 0 -> Red's turn
	if err := g.SetClue("ocean", 3); err != nil {
		t.Fatalf("SetClue: %s", err)
	}
	// idx 6 is Blue, current team is Red -- wrong guess.
	if err := g.Guess(6); err != nil {
		t.Fatalf("Guess: %s", err)
	}
	if g.Round != 1 {
		t.Errorf("Round = %d, want 1 (turn should have ended)", g.Round)
	}
	if g.Clue != "" || g.ClueNumber != 0 || g.CorrectGuesses != 0 {
		t.Errorf("clue state should be reset after turn ends, got clue=%q number=%d correct=%d",
			g.Clue, g.ClueNumber, g.CorrectGuesses)
	}
}

func TestGuessNeutralEndsTurn(t *testing.T) {
	g := makeClueTestGame(Red)
	g.SetClue("ocean", 3)
	// idx 11 is Neutral.
	if err := g.Guess(11); err != nil {
		t.Fatalf("Guess: %s", err)
	}
	if g.Round != 1 {
		t.Errorf("Round = %d, want 1 (neutral guess should end the turn)", g.Round)
	}
}

func TestGuessCorrectDoesNotEndTurnBelowQuota(t *testing.T) {
	g := makeClueTestGame(Red)
	g.SetClue("ocean", 3)
	// idx 0, 1 are Red -- 2 correct guesses, quota is 3, should not end turn.
	if err := g.Guess(0); err != nil {
		t.Fatalf("Guess(0): %s", err)
	}
	if err := g.Guess(1); err != nil {
		t.Fatalf("Guess(1): %s", err)
	}
	if g.Round != 0 {
		t.Errorf("Round = %d, want 0 (turn should still be active)", g.Round)
	}
	if g.CorrectGuesses != 2 {
		t.Errorf("CorrectGuesses = %d, want 2", g.CorrectGuesses)
	}
	if g.Clue != "ocean" {
		t.Errorf("clue should still be set mid-turn, got %q", g.Clue)
	}
}

func TestGuessReachingQuotaDoesNotEndTurn(t *testing.T) {
	g := makeClueTestGame(Red)
	g.SetClue("ocean", 2)
	// Exactly reach the quota (2 correct guesses for a clue number of 2) --
	// the team should still get the option of one bonus guess, so the turn
	// must not end yet.
	g.Guess(0)
	g.Guess(1)
	if g.Round != 0 {
		t.Errorf("Round = %d, want 0 (hitting quota exactly should offer a bonus, not end the turn)", g.Round)
	}
	if g.CorrectGuesses != 2 {
		t.Errorf("CorrectGuesses = %d, want 2", g.CorrectGuesses)
	}
}

func TestGuessBonusEndsTurnEvenIfCorrect(t *testing.T) {
	g := makeClueTestGame(Red)
	g.SetClue("ocean", 2)
	g.Guess(0) // correct, 1/2
	g.Guess(1) // correct, 2/2 -- quota reached, bonus available
	if g.Round != 0 {
		t.Fatalf("precondition failed: turn ended before the bonus guess")
	}
	// idx 2 is also Red -- correct, but this is the bonus (3rd correct
	// guess against a quota of 2), so the turn must end anyway.
	g.Guess(2)
	if g.Round != 1 {
		t.Errorf("Round = %d, want 1 (bonus guess should end the turn even when correct)", g.Round)
	}
	if g.CorrectGuesses != 0 {
		t.Errorf("CorrectGuesses should reset after the turn ends, got %d", g.CorrectGuesses)
	}
}

func TestGuessUnlimitedClueNeverCapsOnCorrectGuesses(t *testing.T) {
	g := makeClueTestGame(Red)
	g.SetClue("ocean", 0) // unlimited
	// 4 of Red's 6 cards -- deliberately not all of them, so this exercises
	// "no cap" rather than accidentally also exercising "game just ended".
	g.Guess(0)
	g.Guess(1)
	g.Guess(2)
	g.Guess(3)
	if g.Round != 0 {
		t.Errorf("Round = %d, want 0 (unlimited clue should never auto-cap on correct guesses)", g.Round)
	}
	if g.CorrectGuesses != 4 {
		t.Errorf("CorrectGuesses = %d, want 4", g.CorrectGuesses)
	}
	if g.WinningTeam != nil {
		t.Fatalf("precondition failed: game ended unexpectedly, invalidating this test")
	}
}

func TestNextTurnResetsClueState(t *testing.T) {
	g := makeClueTestGame(Red)
	g.SetClue("ocean", 3)
	g.Guess(0) // 1 correct, still Red's turn
	if ok := g.NextTurn(0); !ok {
		t.Fatalf("NextTurn should have succeeded")
	}
	if g.Clue != "" || g.ClueNumber != 0 || g.CorrectGuesses != 0 {
		t.Errorf("clue state should be reset after a manual End Turn, got clue=%q number=%d correct=%d",
			g.Clue, g.ClueNumber, g.CorrectGuesses)
	}
	if g.Round != 1 {
		t.Errorf("Round = %d, want 1", g.Round)
	}
}

// TestNextGameStateClearsClue guards against a real bug found via an
// end-to-end HTTP test: nextGameState (the "Next Game" path that reuses the
// same word pool) mutates and returns an existing GameState, so it must
// explicitly zero the clue fields itself -- unlike randomState, which builds
// a fresh struct literal and gets this for free. Without the fix, a clue
// from the old board leaked into the freshly dealt one.
func TestNextGameStateClearsClue(t *testing.T) {
	g := makeClueTestGame(Red)
	g.SetClue("ocean", 3)
	g.Guess(0) // 1 correct guess, quota not yet reached

	next := nextGameState(g.GameState)
	if next.Clue != "" || next.ClueNumber != 0 || next.CorrectGuesses != 0 {
		t.Errorf("nextGameState should clear clue state, got clue=%q number=%d correct=%d",
			next.Clue, next.ClueNumber, next.CorrectGuesses)
	}
	if next.Round != 0 {
		t.Errorf("Round = %d, want 0 for a fresh board", next.Round)
	}
}

func TestNewClueAfterTurnChange(t *testing.T) {
	g := makeClueTestGame(Red)
	g.SetClue("ocean", 3)
	g.Guess(6) // wrong (Blue card) -- ends Red's turn
	if g.Round != 1 {
		t.Fatalf("precondition failed: turn did not end")
	}
	// Now it's Blue's turn; a fresh clue should be settable.
	if err := g.SetClue("river", 2); err != nil {
		t.Fatalf("SetClue on the new turn should succeed: %s", err)
	}
	if g.Clue != "river" || g.ClueNumber != 2 {
		t.Errorf("got clue=%q number=%d, want river/2", g.Clue, g.ClueNumber)
	}
}

func TestGuessBlackCardEndsGameRegardlessOfClue(t *testing.T) {
	g := makeClueTestGame(Red)
	g.SetClue("ocean", 3)
	g.Guess(0) // 1 correct
	// idx 10 is Black.
	if err := g.Guess(10); err != nil {
		t.Fatalf("Guess(black): %s", err)
	}
	if g.WinningTeam == nil {
		t.Fatal("WinningTeam should be set after the black card is guessed")
	}
	if *g.WinningTeam != Blue {
		t.Errorf("WinningTeam = %s, want Blue (Red guessed the black card)", g.WinningTeam.String())
	}
}

func TestGuessWinningLastCardIgnoresQuota(t *testing.T) {
	// A game where Red only has one card left, well within an unmet quota
	// of 3 -- winning should short-circuit the quota/bonus bookkeeping
	// entirely, not just coincidentally leave the turn active.
	g := makeClueTestGame(Red)
	g.Revealed[1] = true
	g.Revealed[2] = true
	g.Revealed[3] = true
	g.Revealed[4] = true
	g.Revealed[5] = true // Red's other 5 cards already gone
	g.SetClue("ocean", 3)
	if err := g.Guess(0); err != nil { // Red's last card
		t.Fatalf("Guess: %s", err)
	}
	if g.WinningTeam == nil || *g.WinningTeam != Red {
		t.Fatal("Red should have won by revealing their last card")
	}
}

func TestSetClueUnaffectedByOtherGameFields(t *testing.T) {
	// Sanity check that a normally-constructed game (via newGame, the real
	// production path -- not the hand-built layout the other tests use)
	// also accepts a clue without issue.
	state := randomState([]string{
		"a", "b", "c", "d", "e", "f", "g", "h", "i", "j",
		"k", "l", "m", "n", "o", "p", "q", "r", "s", "t",
		"u", "v", "w", "x", "y",
	})
	g := newGame("real-game-test", state, GameOptions{})
	if err := g.SetClue("clue", 2); err != nil {
		t.Fatalf("SetClue on a newGame-constructed game: %s", err)
	}
}
