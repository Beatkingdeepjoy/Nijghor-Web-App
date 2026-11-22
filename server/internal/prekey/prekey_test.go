package prekey_test

import (
	"encoding/base64"
	"testing"
)

func TestPrekeyBase64Encoding(t *testing.T) {
	dummyCurve25519Key := make([]byte, 32)
	for i := range dummyCurve25519Key {
		dummyCurve25519Key[i] = byte(i)
	}

	encoded := base64.StdEncoding.EncodeToString(dummyCurve25519Key)
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("Failed to decode base64: %v", err)
	}

	if len(decoded) != 32 {
		t.Fatalf("Decoded key length mismatch: got %d, want 32", len(decoded))
	}

	for i := range dummyCurve25519Key {
		if decoded[i] != dummyCurve25519Key[i] {
			t.Fatalf("Byte mismatch at index %d", i)
		}
	}
}
