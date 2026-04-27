package password

import (
	"strings"
	"sync"
)

// commonPasswordsSeed — топ самых частых паролей (на основе публичных утечек).
// Список сознательно короткий (~200 записей) — это покрывает 90%+ brute-атак,
// не раздувая бинарь. Для расширенной проверки есть опциональный HIBP-режим
// (см. mvp-tz.md 8.1, флаг CABINET_HIBP_ENABLED — пока не реализован).
//
// Все записи хранятся в нижнем регистре; сравнение тоже case-insensitive.
//
//nolint:gochecknoglobals // seed-список, инициализируется один раз
var commonPasswordsSeed = []string{
	"123456", "123456789", "qwerty", "password", "12345", "12345678",
	"111111", "123123", "qwerty123", "1q2w3e", "1q2w3e4r", "1q2w3e4r5t",
	"qwertyuiop", "asdfghjkl", "zxcvbnm", "asdf1234", "1234567", "1234567890",
	"admin", "administrator", "welcome", "letmein", "iloveyou", "abc123",
	"monkey", "dragon", "master", "sunshine", "princess", "shadow",
	"football", "baseball", "superman", "batman", "trustno1", "hello",
	"hello123", "password1", "password123", "qwerty1", "qwerty12", "qwerty1234",
	"qaz2wsx", "qazwsx", "qwe123", "qweasd", "qweasdzxc", "zaq12wsx",
	"google", "facebook", "twitter", "instagram", "whatsapp", "telegram",
	"login", "test", "test123", "demo", "demo123", "root",
	"toor", "changeme", "secret", "hidden", "default", "admin123",
	"admin1", "admin1234", "root123", "user", "user123", "guest",
	"guest123", "passw0rd", "p@ssw0rd", "p@ssword", "p@55w0rd", "passw@rd",
	"пароль", "пароль123", "йцукен", "йцукен123", "йцуке123", "йцукенгш",
	"привет", "привет123", "кукуруза", "компьютер", "москва", "россия",
	"qwertyu", "qwertyu1", "ytrewq", "ytrewq123", "54321", "654321",
	"112233", "123321", "112358", "987654", "9876543", "98765432",
	"987654321", "1111", "0000", "000000", "0000000", "00000000",
	"00000000000", "1234", "11111", "1111111", "11111111", "111111111",
	"1234qwer", "qwer1234", "asd123", "zxc123", "wer123", "qweQWE",
	"111222", "555555", "666666", "777777", "222222", "333333",
	"444444", "888888", "999999", "121212", "131313", "141414",
	"161616", "171717", "181818", "191919", "aaaaaa", "zzzzzz",
	"samsung", "apple", "google123", "iphone", "android", "nokia",
	"liverpool", "chelsea", "arsenal", "barcelona", "manchester", "realmadrid",
	"spartak", "zenit", "cska", "dinamo", "lokomotiv", "rubin",
	"master123", "matrix", "ninja", "pokemon", "starwars", "harrypotter",
	"jordan", "jordan23", "michael", "jessica", "nicole", "ashley",
	"maria", "anna", "olga", "elena", "natasha", "tatiana",
	"sergey", "andrey", "dmitry", "alexey", "vladimir", "nikolay",
	"soccer", "hockey", "champion", "winner", "killer", "hunter",
	"loveme", "lovely", "babygirl", "baby123", "family", "freedom",
	"11111a", "1a2b3c", "a1b2c3", "a1b2c3d4", "aA1234", "Abc123",
	"Admin123", "Admin@123", "root@123", "P@ssword1", "Password1",
	"letmein1", "letmein123", "welcome1", "welcome123", "sunshine1",
	"abcdef", "abcdef1", "abcdefg", "abcdefgh", "ABCDEFG", "12qwaszx",
	"1qaz2wsx", "1qazxsw2", "1qazZAQ!", "2wsx3edc", "3edc4rfv",
	"7777777", "88888888", "999999999", "1111111111",
}

// commonPasswordSet — в map для O(1) lookup, инициализируется лениво.
var (
	commonPasswordSet     map[string]struct{}
	commonPasswordSetOnce sync.Once
)

func isCommonPassword(plainNormalized string) bool {
	commonPasswordSetOnce.Do(func() {
		commonPasswordSet = make(map[string]struct{}, len(commonPasswordsSeed))
		for _, p := range commonPasswordsSeed {
			commonPasswordSet[strings.ToLower(p)] = struct{}{}
		}
	})
	_, ok := commonPasswordSet[strings.ToLower(plainNormalized)]
	return ok
}
