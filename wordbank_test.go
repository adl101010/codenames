package codenames

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"testing"
)

// loadWordBanks reads frontend/words.json, the file the client builds its
// word lists from.
func loadWordBanks(t *testing.T) map[string][]string {
	t.Helper()
	b, err := ioutil.ReadFile("frontend/words.json")
	if err != nil {
		t.Fatal(err)
	}
	var banks map[string][]string
	if err := json.Unmarshal(b, &banks); err != nil {
		t.Fatal(err)
	}
	return banks
}

// canonicalBank runs a bank through the same Canonicalize step the server
// applies to whatever word list a client sends, on a copy -- Canonicalize
// reuses the slice it's given.
func canonicalBank(t *testing.T, name string, words []string) []string {
	t.Helper()
	var ws WordSets
	_, canon, err := ws.Canonicalize(append([]string{}, words...))
	if err != nil {
		t.Fatalf("bank %q: %s", name, err)
	}
	return canon
}

// assertDealtFromBank checks a freshly built board is a full, valid deal:
// wordsPerGame distinct words, every one of them from the bank.
func assertDealtFromBank(t *testing.T, label string, g *Game, bank []string) {
	t.Helper()
	inBank := make(map[string]bool, len(bank))
	for _, w := range bank {
		inBank[w] = true
	}
	if len(g.Words) != wordsPerGame || len(g.Layout) != wordsPerGame {
		t.Fatalf("%s: dealt %d words / %d layout cells, want %d of each",
			label, len(g.Words), len(g.Layout), wordsPerGame)
	}
	seen := map[string]bool{}
	for _, w := range g.Words {
		if !inBank[w] {
			t.Errorf("%s: dealt %q, which isn't in the bank", label, w)
		}
		if seen[w] {
			t.Errorf("%s: %q appears twice on one board", label, w)
		}
		seen[w] = true
	}
}

// TestEveryWordBankCanDealABoard guards the thing that goes wrong when a
// bank is added or edited: newGame slices 25 words out of a shuffled copy
// of the bank, so a bank too small to deal from would panic the server the
// moment someone picked it. It also pins the keys the frontend looks up by
// name in computeWordSet -- a missing key there is a spread of undefined.
func TestEveryWordBankCanDealABoard(t *testing.T) {
	banks := loadWordBanks(t)

	for _, required := range []string{"English", "English (Mature)", "Holiday"} {
		if _, ok := banks[required]; !ok {
			t.Errorf("frontend/words.json is missing the %q bank that computeWordSet reads", required)
		}
	}

	for name, words := range banks {
		canon := canonicalBank(t, name, words)
		if len(canon) < wordsPerGame {
			t.Errorf("bank %q has %d distinct words, need at least %d to deal a board",
				name, len(canon), wordsPerGame)
			continue
		}
		g := newGame("bank-"+name, randomState(canon), GameOptions{})
		assertDealtFromBank(t, name, g, canon)
	}
}

// TestHolidayBankSurvivesRepeatedNextGames matters because the holiday
// bank is small -- 75 words, so each board is a third of the whole deck.
// "Next game" walks PermIndex along the same shuffle, then reseeds once it
// runs out; this plays far more games than the deck holds, to make sure
// that hand-off never deals a short or invalid board or slices off the end.
func TestHolidayBankSurvivesRepeatedNextGames(t *testing.T) {
	canon := canonicalBank(t, "Holiday", loadWordBanks(t)["Holiday"])

	state := randomState(canon)
	for game := 0; game < 30; game++ {
		if state.PermIndex+wordsPerGame > len(canon) {
			t.Fatalf("game %d: PermIndex %d would slice past the end of a %d-word bank",
				game, state.PermIndex, len(canon))
		}
		g := newGame("holiday-series", state, GameOptions{})
		assertDealtFromBank(t, fmt.Sprintf("Holiday game %d", game), g, canon)
		state = nextGameState(state)
	}
}

// TestHolidayBankIsNotAlteredByMatureCap documents that the mature-word
// cap is inert for the holiday bank. CANDLE and TOY happen to be on the
// mature list, but a holiday board can hold at most those two and the cap
// only acts above maxMatureWords -- so with the real mature list loaded, a
// holiday board must come out identical to one dealt with the cap off.
func TestHolidayBankIsNotAlteredByMatureCap(t *testing.T) {
	saved := matureWords
	defer func() { matureWords = saved }()

	canon := canonicalBank(t, "Holiday", loadWordBanks(t)["Holiday"])

	for trial := 0; trial < 50; trial++ {
		state := randomState(canon)

		matureWords = nil
		uncapped := newGame("holiday-nocap", state, GameOptions{})

		if err := loadMatureWords("assets/mature.txt"); err != nil {
			t.Fatal(err)
		}
		if len(matureWords) == 0 {
			t.Fatal("expected assets/mature.txt to load a non-empty list")
		}
		capped := newGame("holiday-cap", state, GameOptions{})

		for i := range uncapped.Words {
			if uncapped.Words[i] != capped.Words[i] {
				t.Fatalf("trial %d: cell %d is %q with the cap off but %q with it on",
					trial, i, uncapped.Words[i], capped.Words[i])
			}
			if uncapped.Layout[i] != capped.Layout[i] {
				t.Fatalf("trial %d: cell %d's team changed with the cap on", trial, i)
			}
		}
	}
}
