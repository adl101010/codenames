package codenames

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"
)

// newTestServer builds a minimal Server sufficient to call handler methods
// directly (bypassing Start(), which binds a real port and loads asset
// files from disk -- unnecessary for testing request/response wiring).
func newTestServer() *Server {
	words := make([]string, wordsPerGame)
	for i := range words {
		words[i] = fmt.Sprintf("WORD%d", i)
	}
	return &Server{
		Store:        discardStore{},
		games:        make(map[string]*GameHandle),
		defaultWords: words,
	}
}

func TestHandleSetClueEndToEnd(t *testing.T) {
	s := newTestServer()

	body := `{"game_id":"http-test-1","clue":"ocean","number":3}`
	req := httptest.NewRequest("POST", "/set-clue", strings.NewReader(body))
	rw := httptest.NewRecorder()
	s.handleSetClue(rw, req)

	if rw.Code != 200 {
		t.Fatalf("status = %d, body = %s", rw.Code, rw.Body.String())
	}

	var resp struct {
		Clue       string `json:"clue"`
		ClueNumber int    `json:"clue_number"`
	}
	if err := json.Unmarshal(rw.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decoding response: %s", err)
	}
	if resp.Clue != "ocean" || resp.ClueNumber != 3 {
		t.Errorf("got clue=%q number=%d, want ocean/3", resp.Clue, resp.ClueNumber)
	}
}

func TestHandleSetClueRejectsInvalid(t *testing.T) {
	s := newTestServer()
	body := `{"game_id":"http-test-2","clue":"","number":3}`
	req := httptest.NewRequest("POST", "/set-clue", strings.NewReader(body))
	rw := httptest.NewRecorder()
	s.handleSetClue(rw, req)
	if rw.Code != 400 {
		t.Errorf("status = %d, want 400 for an empty clue", rw.Code)
	}
}

func TestHandleSetClueRejectsBadJSON(t *testing.T) {
	s := newTestServer()
	req := httptest.NewRequest("POST", "/set-clue", strings.NewReader("not json"))
	rw := httptest.NewRecorder()
	s.handleSetClue(rw, req)
	if rw.Code != 400 {
		t.Errorf("status = %d, want 400 for malformed JSON", rw.Code)
	}
}

// TestHandleSetClueRoundTripThroughGuess exercises the full HTTP cycle a
// real client goes through: set a clue over HTTP, then guess a correct
// card over HTTP, and confirm the clue and guess count both survive in
// the JSON response with the field names the frontend actually reads
// (clue, clue_number, correct_guesses) -- a typo in a json tag wouldn't
// be caught by the internal-only tests in clue_test.go, since those call
// Go methods directly and never touch JSON at all.
func TestHandleSetClueRoundTripThroughGuess(t *testing.T) {
	s := newTestServer()
	gameID := "http-test-3"

	setClueBody := fmt.Sprintf(`{"game_id":%q,"clue":"ocean","number":2}`, gameID)
	req := httptest.NewRequest("POST", "/set-clue", strings.NewReader(setClueBody))
	rw := httptest.NewRecorder()
	s.handleSetClue(rw, req)
	if rw.Code != 200 {
		t.Fatalf("set-clue status = %d: %s", rw.Code, rw.Body.String())
	}

	gh := s.getGame(gameID)
	gh.mu.Lock()
	currentTeam := gh.g.currentTeam()
	idx := -1
	for i, c := range gh.g.Layout {
		if c == currentTeam {
			idx = i
			break
		}
	}
	gh.mu.Unlock()
	if idx == -1 {
		t.Fatalf("no card found for the current team %s", currentTeam)
	}

	guessBody := fmt.Sprintf(`{"game_id":%q,"index":%d}`, gameID, idx)
	req2 := httptest.NewRequest("POST", "/guess", strings.NewReader(guessBody))
	rw2 := httptest.NewRecorder()
	s.handleGuess(rw2, req2)
	if rw2.Code != 200 {
		t.Fatalf("guess status = %d: %s", rw2.Code, rw2.Body.String())
	}

	var resp struct {
		Clue           string `json:"clue"`
		ClueNumber     int    `json:"clue_number"`
		CorrectGuesses int    `json:"correct_guesses"`
	}
	if err := json.Unmarshal(rw2.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decoding response: %s", err)
	}
	if resp.Clue != "ocean" {
		t.Errorf("clue should survive a correct guess, got %q", resp.Clue)
	}
	if resp.ClueNumber != 2 {
		t.Errorf("clue_number = %d, want 2", resp.ClueNumber)
	}
	if resp.CorrectGuesses != 1 {
		t.Errorf("correct_guesses = %d, want 1", resp.CorrectGuesses)
	}
}

// TestHandleEndTurnClearsClueOverHTTP is the same kind of JSON-field-name
// check as above, for the End Turn path.
func TestHandleEndTurnClearsClueOverHTTP(t *testing.T) {
	s := newTestServer()
	gameID := "http-test-4"

	setClueBody := fmt.Sprintf(`{"game_id":%q,"clue":"ocean","number":2}`, gameID)
	req := httptest.NewRequest("POST", "/set-clue", strings.NewReader(setClueBody))
	rw := httptest.NewRecorder()
	s.handleSetClue(rw, req)
	if rw.Code != 200 {
		t.Fatalf("set-clue status = %d: %s", rw.Code, rw.Body.String())
	}

	endTurnBody := fmt.Sprintf(`{"game_id":%q,"current_round":0}`, gameID)
	req2 := httptest.NewRequest("POST", "/end-turn", strings.NewReader(endTurnBody))
	rw2 := httptest.NewRecorder()
	s.handleEndTurn(rw2, req2)
	if rw2.Code != 200 {
		t.Fatalf("end-turn status = %d: %s", rw2.Code, rw2.Body.String())
	}

	var resp struct {
		Clue  string `json:"clue"`
		Round int    `json:"round"`
	}
	if err := json.Unmarshal(rw2.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decoding response: %s", err)
	}
	if resp.Clue != "" {
		t.Errorf("clue should be cleared after End Turn, got %q", resp.Clue)
	}
	if resp.Round != 1 {
		t.Errorf("round = %d, want 1", resp.Round)
	}
}
