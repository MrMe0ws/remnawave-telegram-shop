package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

func createGitHubRelease(version, notes, repo string) error {
	tag := normalizeReleaseVersion(version)
	if tag == "" {
		return fmt.Errorf("version is empty")
	}
	title := tag

	args := []string{
		"release", "create", tag,
		"--title", title,
		"--notes", notes,
	}
	repo = strings.TrimSpace(repo)
	if repo != "" {
		args = append(args, "--repo", repo)
	}

	cmd := exec.Command("gh", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("gh release create: %w", err)
	}
	return nil
}
