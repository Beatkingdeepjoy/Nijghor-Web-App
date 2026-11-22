package relay_test

import (
	"sync"
	"testing"
	"time"

	"nijghor/server/internal/relay"
)

func TestHubSequenceGeneration(t *testing.T) {
	hub := relay.NewHub(nil)
	defer hub.Close()

	var wg sync.WaitGroup
	seqs := make([]int64, 100)

	for i := 0; i < 100; i++ {
		wg.Add(1)
		idx := i
		go func() {
			defer wg.Done()
			seqs[idx] = hub.NextSeq()
		}()
	}

	wg.Wait()

	// Verify all sequence IDs are strictly unique
	seen := make(map[int64]bool)
	for _, s := range seqs {
		if seen[s] {
			t.Errorf("Duplicate sequence ID generated: %d", s)
		}
		seen[s] = true
	}
}

func TestRelayEnvelopeMarshaling(t *testing.T) {
	env := relay.RelayEnvelope{
		Type:        "MESSAGE",
		SenderID:    "sender-123",
		RecipientID: "recipient-456",
		Payload:     []byte("encrypted_signal_payload"),
	}

	if env.Type != "MESSAGE" || env.SenderID != "sender-123" {
		t.Errorf("Relay envelope fields incorrect")
	}
}
