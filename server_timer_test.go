package codenames

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestHandleToggleTimerEndToEnd exercises the full HTTP cycle: enable a
// timer via /set-options (a lazily-created game starts with no timer),
// then pause and resume it via /toggle-timer, checking the JSON field
// name the frontend actually reads (timer_paused) at each step.
func TestHandleToggleTimerEndToEnd(t *testing.T) {
	s := newTestServer()
	gameID := "timer-http-test-1"

	setOptionsBody := fmt.Sprintf(
		`{"game_id":%q,"timer_duration_ms":300000,"enforce_timer":false}`, gameID)
	req := httptest.NewRequest("POST", "/set-options", strings.NewReader(setOptionsBody))
	rw := httptest.NewRecorder()
	s.handleSetOptions(rw, req)
	if rw.Code != 200 {
		t.Fatalf("set-options status = %d: %s", rw.Code, rw.Body.String())
	}

	toggleBody := fmt.Sprintf(`{"game_id":%q}`, gameID)

	// First toggle: pause.
	req2 := httptest.NewRequest("POST", "/toggle-timer", strings.NewReader(toggleBody))
	rw2 := httptest.NewRecorder()
	s.handleToggleTimer(rw2, req2)
	if rw2.Code != 200 {
		t.Fatalf("toggle-timer (pause) status = %d: %s", rw2.Code, rw2.Body.String())
	}
	var resp struct {
		TimerPaused bool `json:"timer_paused"`
	}
	if err := json.Unmarshal(rw2.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decoding response: %s", err)
	}
	if !resp.TimerPaused {
		t.Errorf("timer_paused = %v after first toggle, want true", resp.TimerPaused)
	}

	// Second toggle: resume.
	req3 := httptest.NewRequest("POST", "/toggle-timer", strings.NewReader(toggleBody))
	rw3 := httptest.NewRecorder()
	s.handleToggleTimer(rw3, req3)
	if rw3.Code != 200 {
		t.Fatalf("toggle-timer (resume) status = %d: %s", rw3.Code, rw3.Body.String())
	}
	if err := json.Unmarshal(rw3.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decoding response: %s", err)
	}
	if resp.TimerPaused {
		t.Errorf("timer_paused = %v after second toggle, want false", resp.TimerPaused)
	}
}

func TestHandleToggleTimerRejectsWhenTimerNotEnabled(t *testing.T) {
	s := newTestServer()
	body := `{"game_id":"timer-http-test-2"}`
	req := httptest.NewRequest("POST", "/toggle-timer", strings.NewReader(body))
	rw := httptest.NewRecorder()
	s.handleToggleTimer(rw, req)
	if rw.Code != 400 {
		t.Errorf("status = %d, want 400 for a game with no timer enabled", rw.Code)
	}
}

func TestHandleToggleTimerRejectsBadJSON(t *testing.T) {
	s := newTestServer()
	req := httptest.NewRequest("POST", "/toggle-timer", strings.NewReader("not json"))
	rw := httptest.NewRecorder()
	s.handleToggleTimer(rw, req)
	if rw.Code != 400 {
		t.Errorf("status = %d, want 400 for malformed JSON", rw.Code)
	}
}
