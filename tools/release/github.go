package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

func createGitHubRelease(version, notes, repo string) error {
	version = strings.TrimSpace(version)
	if version == "" {
		return fmt.Errorf("version is empty")
	}
	tag := version
	if !strings.HasPrefix(tag, "v") {
		tag = "v" + version
	}
	title := version
	if strings.HasPrefix(title, "v") {
		title = strings.TrimPrefix(title, "v")
	}

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
