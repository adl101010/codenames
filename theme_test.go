package codenames

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/cockroachdb/pebble"
)

func TestSetThemeAcceptsIDsAndTheDefault(t *testing.T) {
	for _, theme := range []string{"snow", "evergreen", "fire", "nye", "classic", ""} {
		g := makeClueTestGame(Red)
		if err := g.SetTheme(theme); err != nil {
			t.Errorf("SetTheme(%q): %s", theme, err)
		}
		if g.Theme != theme {
			t.Errorf("Theme = %q after SetTheme(%q)", g.Theme, theme)
		}
	}
}

// The value is echoed to every connected browser and used there as a CSS
// hook, so anything that isn't plausibly an id has to be refused -- and a
// refused value must leave the existing theme alone.
func TestSetThemeRejectsAnythingThatIsNotAnID(t *testing.T) {
	bad := []string{
		"Snow",              // uppercase
		"new-year",          // punctuation
		"has space",         // whitespace
		"snow2",             // digits
		"../../etc",         // path-ish
		"snow\"><script>",   // markup
		"abcdefghijklmnopq", // 17 chars, one over the limit
		"snow\n",            // trailing newline slips past naive checks
	}
	for _, theme := range bad {
		g := makeClueTestGame(Red)
		g.Theme = "evergreen"
		if err := g.SetTheme(theme); err == nil {
			t.Errorf("SetTheme(%q) should have been rejected", theme)
		}
		if g.Theme != "evergreen" {
			t.Errorf("rejected SetTheme(%q) still changed the theme to %q", theme, g.Theme)
		}
	}
}

// Changing the look mid-turn must never touch the timer: no restart, no
// unpause. (SetOptions, which does reset it, is deliberately not used.)
func TestSetThemeLeavesTheTimerAlone(t *testing.T) {
	g := makeTimerTestGame(Red)
	if err := g.PauseTimer(); err != nil {
		t.Fatal(err)
	}
	started := g.RoundStartedAt

	if err := g.SetTheme("snow"); err != nil {
		t.Fatal(err)
	}
	if !g.TimerPaused {
		t.Error("changing the theme unpaused the timer")
	}
	if !g.RoundStartedAt.Equal(started) {
		t.Error("changing the theme moved RoundStartedAt")
	}
}

// The key must always be present in the JSON, including when it's empty.
// omitempty would drop it and leave other clients with no way to tell
// "back to the default" from "never sent" -- the same trap clue and
// timer_paused were already bitten by.
func TestThemeKeyIsAlwaysSerialized(t *testing.T) {
	for _, theme := range []string{"", "fire"} {
		g := makeClueTestGame(Red)
		g.Theme = theme
		b, err := json.Marshal(g)
		if err != nil {
			t.Fatal(err)
		}
		var raw map[string]interface{}
		if err := json.Unmarshal(b, &raw); err != nil {
			t.Fatal(err)
		}
		got, ok := raw["theme"]
		if !ok {
			t.Fatalf("theme=%q: the \"theme\" key is missing from the JSON", theme)
		}
		if got != theme {
			t.Errorf("theme=%q serialized as %v", theme, got)
		}
	}
}

// A theme chosen at the table has to survive the container restarting,
// which is the Pebble save/restore path -- not just JSON in memory.
func TestThemeSurvivesARestart(t *testing.T) {
	dir, err := ioutil.TempDir("", "test-theme-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)

	var ps PebbleStore
	if ps.DB, err = pebble.Open(dir, nil); err != nil {
		t.Fatal(err)
	}
	g := newGame("theme-restart", randomState(words), GameOptions{})
	if err := g.SetTheme("evergreen"); err != nil {
		t.Fatal(err)
	}
	if err := ps.Save(g); err != nil {
		t.Fatal(err)
	}
	if err := ps.DB.Close(); err != nil {
		t.Fatal(err)
	}

	if ps.DB, err = pebble.Open(dir, nil); err != nil {
		t.Fatal(err)
	}
	defer ps.DB.Close()
	restored, err := ps.Restore()
	if err != nil {
		t.Fatal(err)
	}
	got, ok := restored["theme-restart"]
	if !ok {
		t.Fatal("game wasn't restored at all")
	}
	if got.Theme != "evergreen" {
		t.Errorf("restored theme = %q, want evergreen", got.Theme)
	}
}

func postJSON(t *testing.T, handler func(http.ResponseWriter, *http.Request), path, body string) *httptest.ResponseRecorder {
	t.Helper()
	rw := httptest.NewRecorder()
	handler(rw, httptest.NewRequest("POST", path, strings.NewReader(body)))
	return rw
}

func TestHandleSetThemeEndToEnd(t *testing.T) {
	s := newTestServer()
	id := "theme-http-1"

	rw := postJSON(t, s.handleSetTheme, "/set-theme", fmt.Sprintf(`{"game_id":%q,"theme":"snow"}`, id))
	if rw.Code != 200 {
		t.Fatalf("status = %d: %s", rw.Code, rw.Body.String())
	}
	var resp struct {
		Theme string `json:"theme"`
	}
	if err := json.Unmarshal(rw.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Theme != "snow" {
		t.Errorf("response theme = %q, want snow", resp.Theme)
	}

	// The change has to be what the *next* client to ask for the game sees.
	if got := s.getGame(id).g.Theme; got != "snow" {
		t.Errorf("stored theme = %q, want snow", got)
	}
}

func TestHandleSetThemeRejectsBadInput(t *testing.T) {
	s := newTestServer()
	for name, body := range map[string]string{
		"invalid id": `{"game_id":"theme-http-2","theme":"Not A Theme"}`,
		"bad json":   `not json`,
	} {
		if rw := postJSON(t, s.handleSetTheme, "/set-theme", body); rw.Code != 400 {
			t.Errorf("%s: status = %d, want 400", name, rw.Code)
		}
	}
}

// Starting a new game replaces the whole Game object, so the theme only
// survives if the server carries it across. It must also be persisted by
// that point, not just held in memory (newHandle saves immediately).
func TestNextGameKeepsTheTheme(t *testing.T) {
	s := newTestServer()
	id := "theme-http-3"

	// Create the game, theme it, then start a new game with no theme in
	// the request -- what a stale tab or an older device would send.
	postJSON(t, s.handleNextGame, "/next-game", fmt.Sprintf(`{"game_id":%q,"create_new":false}`, id))
	postJSON(t, s.handleSetTheme, "/set-theme", fmt.Sprintf(`{"game_id":%q,"theme":"fire"}`, id))
	original := s.getGame(id)

	rw := postJSON(t, s.handleNextGame, "/next-game", fmt.Sprintf(`{"game_id":%q,"create_new":true}`, id))
	if rw.Code != 200 {
		t.Fatalf("next-game status = %d: %s", rw.Code, rw.Body.String())
	}
	if s.getGame(id) == original {
		t.Fatal("expected a brand new game, got the old one back")
	}

	var resp struct {
		Theme string `json:"theme"`
	}
	if err := json.Unmarshal(rw.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Theme != "fire" {
		t.Errorf("theme after next game = %q, want fire", resp.Theme)
	}
}
