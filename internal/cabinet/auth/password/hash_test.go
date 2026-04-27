package password

import "testing"

// testParams — быстрый Argon2 для unit-тестов (не для прода).
func testParams() Params {
	return Params{
		Memory:      8,
		Iterations:  1,
		Parallelism: 1,
		SaltLen:     8,
		KeyLen:      16,
	}
}

func TestHashPassword_ComparePasswordAndHash_roundTrip(t *testing.T) {
	p := testParams()
	plain := "correct-horse-battery-staple-9"
	hash, err := HashPassword(plain, p)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	ok, needsRehash, err := ComparePasswordAndHash(plain, hash, DefaultParams())
	if err != nil {
		t.Fatalf("Compare: %v", err)
	}
	if !ok {
		t.Fatal("expected password match")
	}
	if !needsRehash {
		t.Fatal("test params weaker than DefaultParams — expected needsRehash true")
	}
	ok, _, err = ComparePasswordAndHash("wrong", hash, p)
	if err != nil {
		t.Fatalf("Compare wrong: %v", err)
	}
	if ok {
		t.Fatal("expected mismatch for wrong password")
	}
}

func TestComparePasswordAndHash_invalidFormat(t *testing.T) {
	_, _, err := ComparePasswordAndHash("x", "not-a-phc-string", DefaultParams())
	if err == nil {
		t.Fatal("expected error")
	}
}
