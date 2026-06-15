package remnawave

import "testing"

func TestCustomerIDFromPanelUsername(t *testing.T) {
	id, ok := CustomerIDFromPanelUsername("42_user@mail.com")
	if !ok || id != 42 {
		t.Fatalf("got id=%d ok=%v", id, ok)
	}
	if _, ok := CustomerIDFromPanelUsername("nope"); ok {
		t.Fatal("expected false for plain username")
	}
	if _, ok := CustomerIDFromPanelUsername("0_bad"); ok {
		t.Fatal("expected false for zero id")
	}
}

func TestMatchUserAdminSearch_description(t *testing.T) {
	desc := "VIP client note"
	u := User{Description: &desc}
	if !matchUserAdminSearch(u, "vip", "vip") {
		t.Fatal("expected description match")
	}
}
