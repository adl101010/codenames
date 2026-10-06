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
// bank is small -- 100 words, so each board is a quarter of the whole deck.
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

// bankKeys maps the ids the frontend's checklist stores to the keys
// they're built from in words.json (see WORD_BANKS in frontend/wordset.ts).
var bankKeys = []struct{ id, key string }{
	{"standard", "English"},
	{"mature", "English (Mature)"},
	{"holiday", "Holiday"},
}

// comboPool builds the pool the frontend would send for a set of checked
// banks: their words combined, run through the server's canonicalizer.
func comboPool(t *testing.T, banks map[string][]string, mask int) (label string, pool []string, hasNonMature bool) {
	t.Helper()
	var words []string
	for i, b := range bankKeys {
		if mask&(1<<uint(i)) == 0 {
			continue
		}
		if label != "" {
			label += "+"
		}
		label += b.id
		words = append(words, banks[b.key]...)
		if b.id != "mature" {
			hasNonMature = true
		}
	}
	return label, canonicalBank(t, label, words), hasNonMature
}

// TestEveryBankComboDealsValidBoards runs every non-empty combination of
// checked banks the checklist allows -- all 7 -- and deals boards from the
// combined pool. Each must be a full valid deal. Whenever Mature is mixed
// with something else it must also respect the cap (no more than
// maxMatureWords mature words), including Holiday + Mature, where the
// swap-in words come from a pool of only 98 non-mature words, and where
// CANDLE and TOY count as mature even though they're also holiday words.
// Mature on its own is covered separately below: there's nothing to swap
// in, so the cap can't apply.
func TestEveryBankComboDealsValidBoards(t *testing.T) {
	saved := matureWords
	defer func() { matureWords = saved }()
	if err := loadMatureWords("assets/mature.txt"); err != nil {
		t.Fatal(err)
	}
	banks := loadWordBanks(t)

	tested := 0
	for mask := 1; mask < 1<<uint(len(bankKeys)); mask++ {
		label, pool, hasNonMature := comboPool(t, banks, mask)
		tested++

		for trial := 0; trial < 150; trial++ {
			g := newGame("combo-"+label, randomState(pool), GameOptions{})
			assertDealtFromBank(t, label, g, pool)

			if !hasNonMature {
				continue // mature-only: see TestMatureAloneDealsAFullMatureBoard
			}
			var mature int
			for _, w := range g.Words {
				if matureWords[w] {
					mature++
				}
			}
			if mature > maxMatureWords {
				t.Fatalf("%s trial %d: board has %d mature words, want <= %d",
					label, trial, mature, maxMatureWords)
			}
		}
	}
	if tested != 7 {
		t.Errorf("tested %d bank combinations, expected all 7", tested)
	}
}

// TestMatureAloneDealsAFullMatureBoard pins down what ticking only Mature
// means. The cap works by swapping excess mature words for non-mature ones
// from the same pool; with Mature as the only bank there's nothing to
// swap in, so the cap has nothing to act on and the board is simply 25
// mature words -- which is what choosing only that bank asks for. (The
// frontend used to forbid this selection; it no longer does, see
// frontend/wordset.ts.) The point of the test is that it deals a normal
// full board rather than failing or coming up short.
func TestMatureAloneDealsAFullMatureBoard(t *testing.T) {
	saved := matureWords
	defer func() { matureWords = saved }()
	if err := loadMatureWords("assets/mature.txt"); err != nil {
		t.Fatal(err)
	}

	pool := canonicalBank(t, "mature", loadWordBanks(t)["English (Mature)"])
	for trial := 0; trial < 100; trial++ {
		g := newGame("mature-only", randomState(pool), GameOptions{})
		assertDealtFromBank(t, "mature", g, pool)

		for _, w := range g.Words {
			if !matureWords[w] {
				t.Fatalf("trial %d: a mature-only board contains %q, which isn't a mature word", trial, w)
			}
		}
	}
}
