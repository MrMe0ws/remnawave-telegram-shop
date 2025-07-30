package utils

import (
	"fmt"
	"math/rand"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func MaskHalfInt(input int) string {
	return MaskHalf(strconv.Itoa(input))
}

func MaskHalfInt64(input int64) string {
	return MaskHalf(strconv.FormatInt(input, 10))
}

func MaskHalf(input string) string {
	if input == "" {
		return input
	}
	if len(input) < 2 {
		return input
	}
	length := len(input)
	visibleLength := length / 2
	maskedLength := length - visibleLength
	return input[:visibleLength] + strings.Repeat("*", maskedLength)
}

func GenerateRealisticEmail(tgID int64, tgName string) string {
	domains := []string{"gmail.com", "outlook.com", "yandex.ru", "mail.ru", "bk.ru", "icloud.com"}
	suffixWords := []string{
		"mail", "acc", "user", "team", "box", "main", "dev", "pro", "me", "home", "net", "work",
		"love", "one", "fake", "test", "bot", "live", "info",
		"privet", "poka", "rus", "lol", "kek", "nyasha", "kot", "pupok", "ded", "mama", "papa",
		"hack", "admin", "boss", "moder", "top", "krutoi", "zxc", "lolz", "xaker", "lolka", "smeshno",
		"zhara", "holod", "priv", "krasava", "durak", "smart", "vhod", "netu", "da", "vse", "nikto",
		"neon", "school", "student", "rabota", "progger", "sysadmin", "gamer", "play", "skazka",
		"nerd", "negruzite", "lenin", "lenin228", "sasha", "vanya", "danya", "masha", "nina",
		"cat", "kot", "robot", "mega", "turbo", "real", "god", "evil", "dobro", "anime",
	}

	rand.Seed(time.Now().UnixNano())
	re := regexp.MustCompile("[^a-zA-Z]")
	cleanName := re.ReplaceAllString(tgName, "")
	cleanName = strings.ToLower(cleanName)
	if cleanName == "" {
		cleanName = "user"
	}

	idSuffix2 := fmt.Sprintf("%02d", tgID%100)
	idSuffix3 := fmt.Sprintf("%03d", tgID%1000)
	rand2 := fmt.Sprintf("%02d", rand.Intn(90)+10)
	rand3 := fmt.Sprintf("%03d", rand.Intn(900)+100)
	randWord := suffixWords[rand.Intn(len(suffixWords))]

	formats := []string{
		cleanName,
		cleanName + rand2,
		cleanName + "_" + rand2,
		cleanName + "." + rand2,
		cleanName + idSuffix2,
		cleanName + "_" + idSuffix3,
		cleanName + "." + idSuffix3,
		cleanName + rand2 + idSuffix2,
		cleanName + "_" + rand3,
		cleanName + "." + randWord,
		cleanName + "-" + randWord,
		cleanName + "_" + randWord + rand2,
		cleanName + "." + randWord + "." + rand2,
		cleanName + "_" + randWord + "_" + idSuffix2,
		cleanName + "__" + rand2,
		randWord + cleanName + rand2,
		cleanName + "_mail",
		cleanName + rand2 + "_" + randWord,
		cleanName + "-" + rand2 + "-" + randWord,
		fmt.Sprintf("%s%d", cleanName, rand.Intn(9000)+1000),
		fmt.Sprintf("%s.mail%d", cleanName, rand.Intn(90)+10),
	}

	localPart := formats[rand.Intn(len(formats))]
	if len(localPart) > 32 {
		localPart = localPart[:32]
	}
	localPart = strings.TrimRight(localPart, "._-")
	domain := domains[rand.Intn(len(domains))]
	return fmt.Sprintf("%s@%s", localPart, domain)
}
