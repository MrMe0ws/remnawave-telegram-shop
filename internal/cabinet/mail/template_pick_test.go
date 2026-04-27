package mail

import "testing"

func TestPickTemplate(t *testing.T) {
	if pickTemplate("email_verify", "en") != "email_verify_en.html" {
		t.Fatal(pickTemplate("email_verify", "en"))
	}
	if pickTemplate("email_verify", "ru") != "email_verify_ru.html" {
		t.Fatal()
	}
	if pickTemplate("email_verify", "de") != "email_verify_ru.html" {
		t.Fatal("unknown lang should fall back to ru template")
	}
}

func TestSubjectFor(t *testing.T) {
	if subjectFor("password_reset", "en") != "Password reset" {
		t.Fatal()
	}
	if subjectFor("password_reset", "ru") != "Сброс пароля" {
		t.Fatal()
	}
	if subjectFor("unknown_kind", "en") != "Cabinet notification" {
		t.Fatal()
	}
}
