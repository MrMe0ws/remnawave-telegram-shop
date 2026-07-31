// Command release publishes RELEASE_NOTES.md to GitHub Releases and/or Telegram.
// Not part of the shop Docker image (built only via ./cmd/app).
//
// Usage (from repo root):
//
//	go run ./tools/release preview
//	go run ./tools/release github
//	go run ./tools/release telegram
//	go run ./tools/release publish
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "release: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 || args[0] == "-h" || args[0] == "--help" {
		printUsage()
		return nil
	}
	cmd := args[0]

	root, err := findRepoRoot()
	if err != nil {
		return err
	}
	if err := loadEnvRelease(root); err != nil {
		return err
	}

	notesPath := filepath.Join(root, "RELEASE_NOTES.md")
	if v := strings.TrimSpace(os.Getenv("RELEASE_NOTES_PATH")); v != "" {
		notesPath = v
		if !filepath.IsAbs(notesPath) {
			notesPath = filepath.Join(root, notesPath)
		}
	}

	raw, err := os.ReadFile(notesPath)
	if err != nil {
		return fmt.Errorf("read %s: %w", notesPath, err)
	}
	notes, err := ParseReleaseNotes(string(raw))
	if err != nil {
		return err
	}
	repo := strings.TrimSpace(os.Getenv("RELEASE_GITHUB_REPO"))

	switch cmd {
	case "preview":
		cfg, err := loadTelegramConfig()
		if err != nil {
			return err
		}
		html := FormatTelegramHTML(notes, cfg.Footer)
		fmt.Printf("version: %s\n", notes.Version)
		fmt.Printf("release_url: %s\n", notes.ReleaseURL)
		fmt.Printf("github_repo: %s\n", emptyAs(repo, "(default gh remote)"))
		fmt.Println("--- GitHub notes ---")
		fmt.Println(notes.GitHubBody)
		fmt.Println("--- Telegram HTML ---")
		fmt.Println(html)
		return nil
	case "github":
		return createGitHubRelease(notes.Version, notes.GitHubBody, repo)
	case "telegram":
		cfg, err := loadTelegramConfig()
		if err != nil {
			return err
		}
		html := FormatTelegramHTML(notes, cfg.Footer)
		if err := sendTelegramHTML(cfg, html); err != nil {
			return err
		}
		fmt.Println("telegram: message sent")
		return nil
	case "publish":
		if err := createGitHubRelease(notes.Version, notes.GitHubBody, repo); err != nil {
			return err
		}
		fmt.Println("github: release created")
		cfg, err := loadTelegramConfig()
		if err != nil {
			return fmt.Errorf("github release created, but telegram config invalid: %w", err)
		}
		html := FormatTelegramHTML(notes, cfg.Footer)
		if err := sendTelegramHTML(cfg, html); err != nil {
			return fmt.Errorf("github release created, but telegram failed (retry: go run ./tools/release telegram): %w", err)
		}
		fmt.Println("telegram: message sent")
		return nil
	default:
		printUsage()
		return fmt.Errorf("unknown command %q", cmd)
	}
}

func printUsage() {
	fmt.Fprintf(os.Stderr, `usage:
  go run ./tools/release preview    # print parsed GitHub + Telegram HTML
  go run ./tools/release github     # gh release create from RELEASE_NOTES.md
  go run ./tools/release telegram   # send Telegram HTML to forum topic
  go run ./tools/release publish    # github + telegram

Config: .env.release in repo root (see .env.release.sample).
`)
}

func findRepoRoot() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := wd
	for {
		if fileExists(filepath.Join(dir, "go.mod")) && fileExists(filepath.Join(dir, "RELEASE_NOTES.md")) {
			return dir, nil
		}
		if fileExists(filepath.Join(dir, "go.mod")) {
			// Prefer go.mod root even if RELEASE_NOTES.md missing (preview will fail later).
			if fileExists(filepath.Join(dir, ".git")) || fileExists(filepath.Join(dir, ".env.release.sample")) {
				return dir, nil
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return wd, nil
}

func loadEnvRelease(root string) error {
	path := filepath.Join(root, ".env.release")
	if !fileExists(path) {
		return nil
	}
	if err := godotenv.Load(path); err != nil {
		return fmt.Errorf("load %s: %w", path, err)
	}
	return nil
}

func loadTelegramConfig() (telegramConfig, error) {
	threadID, err := parseThreadID(os.Getenv("RELEASE_TG_MESSAGE_THREAD_ID"))
	if err != nil {
		return telegramConfig{}, err
	}
	footerText := strings.TrimSpace(os.Getenv("RELEASE_TG_FOOTER_TEXT"))
	if footerText == "" {
		footerText = "Meows VPN Group"
	}
	footerURL := strings.TrimSpace(os.Getenv("RELEASE_TG_FOOTER_URL"))
	if footerURL == "" {
		footerURL = "https://t.me/meows_vpn_bot"
	}
	return telegramConfig{
		Token:           strings.TrimSpace(os.Getenv("RELEASE_TG_BOT_TOKEN")),
		ChatID:          strings.TrimSpace(os.Getenv("RELEASE_TG_CHAT_ID")),
		MessageThreadID: threadID,
		Footer: TelegramFooter{
			Text:           footerText,
			URL:            footerURL,
			CustomEmojiID:  strings.TrimSpace(os.Getenv("RELEASE_TG_FOOTER_CUSTOM_EMOJI_ID")),
			CustomEmojiAlt: strings.TrimSpace(os.Getenv("RELEASE_TG_FOOTER_CUSTOM_EMOJI_ALT")),
		},
		ProxyURL: strings.TrimSpace(os.Getenv("RELEASE_TG_PROXY_URL")),
	}, nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func emptyAs(s, fallback string) string {
	if strings.TrimSpace(s) == "" {
		return fallback
	}
	return s
}
