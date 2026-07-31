package codenames

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math/rand"
	"os"
	"strings"
	"testing"
)

// TestCapMatureWords checks the worst case: a board drawn entirely from
// mature words still ends up with no more than maxMatureWords of them.
func TestCapMatureWords(t *testing.T) {
	saved := matureWords
	defer func() { matureWords = saved }()

	matureWords = map[string]bool{}
	var pool []string
	for i := 0; i < 100; i++ {
		w := fmt.Sprintf("MATURE%d", i)
		matureWords[w] = true
		pool = append(pool, w)
	}
	for i := 0; i < 100; i++ {
		pool = append(pool, fmt.Sprintf("SAFE%d", i))
	}

	rnd := rand.New(rand.NewSource(1))
	for trial := 0; trial < 200; trial++ {
		words := make([]string, wordsPerGame)
		for i := range words {
			words[i] = fmt.Sprintf("MATURE%d", i)
		}

		capMatureWords(words, pool, rnd)

		var mature int
		seen := map[string]bool{}
		for _, w := range words {
			if matureWords[w] {
				mature++
			}
			if seen[w] {
				t.Fatalf("trial %d: duplicate word %q on board", trial, w)
			}
			seen[w] = true
		}
		if mature > maxMatureWords {
			t.Fatalf("trial %d: board has %d mature words, want <= %d",
				trial, mature, maxMatureWords)
		}
	}
}

// TestCapMatureWordsDisabled verifies the cap is inert when no mature word
// set is loaded, which is what happens for every game where the client sent
// a safe-only pool.
func TestCapMatureWordsDisabled(t *testing.T) {
	saved := matureWords
	defer func() { matureWords = saved }()
	matureWords = nil

	words := []string{"ALPHA", "BRAVO", "CHARLIE"}
	before := append([]string{}, words...)
	capMatureWords(words, []string{"DELTA", "ECHO"}, rand.New(rand.NewSource(1)))

	for i := range words {
		if words[i] != before[i] {
			t.Fatalf("word %d changed from %q to %q with capping disabled",
				i, before[i], words[i])
		}
	}
}

// TestAssetWordListsMatchFrontend guards against assets/*.txt drifting from
// frontend/words.json. The server reads the assets copies at runtime (the
// JSON is not in the deployed image), so a stale assets/mature.txt would
// silently stop capping words it no longer recognises.
func TestAssetWordListsMatchFrontend(t *testing.T) {
	b, err := ioutil.ReadFile("frontend/words.json")
	if err != nil {
		t.Fatal(err)
	}
	var sets map[string][]string
	if err := json.NewDecoder(bytes.NewReader(b)).Decode(&sets); err != nil {
		t.Fatal(err)
	}

	cases := []struct{ path, key string }{
		{"assets/original.txt", "English"},
		{"assets/mature.txt", "English (Mature)"},
	}
	for _, tc := range cases {
		want, ok := sets[tc.key]
		if !ok {
			t.Errorf("frontend/words.json is missing key %q", tc.key)
			continue
		}
		got, err := readWordLines(tc.path)
		if err != nil {
			t.Errorf("%s: %s", tc.path, err)
			continue
		}
		if len(got) != len(want) {
			t.Errorf("%s has %d words, frontend/words.json[%q] has %d",
				tc.path, len(got), tc.key, len(want))
		}
		inFile := make(map[string]bool, len(got))
		for _, w := range got {
			inFile[w] = true
		}
		for _, w := range want {
			if !inFile[w] {
				t.Errorf("%s is missing %q, present in frontend/words.json[%q]",
					tc.path, w, tc.key)
			}
		}
	}
}

func readWordLines(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var words []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		if w := strings.TrimSpace(scanner.Text()); w != "" {
			words = append(words, w)
		}
	}
	return words, scanner.Err()
}
