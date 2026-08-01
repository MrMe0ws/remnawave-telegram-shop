package handler

import (
	"reflect"
	"testing"
)

func TestSelectCabinetMinimalismExternalURLs(t *testing.T) {
	const (
		fb = "https://t.me/reviews"
		ch = "https://t.me/news"
	)
	tests := []struct {
		name         string
		showFeedback bool
		showChannel  bool
		feedbackURL  string
		channelURL   string
		wantKeys     []string
		wantURLs     []string
	}{
		{name: "both off", wantKeys: nil},
		{name: "feedback on empty url", showFeedback: true, feedbackURL: "", wantKeys: nil},
		{name: "channel on empty url", showChannel: true, channelURL: "  ", wantKeys: nil},
		{
			name: "feedback only", showFeedback: true, feedbackURL: fb,
			wantKeys: []string{"cabinet_minimal_btn_feedback"}, wantURLs: []string{fb},
		},
		{
			name: "channel only", showChannel: true, channelURL: ch,
			wantKeys: []string{"cabinet_minimal_btn_channel"}, wantURLs: []string{ch},
		},
		{
			name: "both", showFeedback: true, showChannel: true, feedbackURL: fb, channelURL: ch,
			wantKeys: []string{"cabinet_minimal_btn_feedback", "cabinet_minimal_btn_channel"},
			wantURLs: []string{fb, ch},
		},
		{
			name: "both flags one url", showFeedback: true, showChannel: true, feedbackURL: fb, channelURL: "",
			wantKeys: []string{"cabinet_minimal_btn_feedback"}, wantURLs: []string{fb},
		},
		{
			name: "trim spaces", showFeedback: true, feedbackURL: "  " + fb + "  ",
			wantKeys: []string{"cabinet_minimal_btn_feedback"}, wantURLs: []string{fb},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := selectCabinetMinimalismExternalURLs(tt.showFeedback, tt.showChannel, tt.feedbackURL, tt.channelURL)
			var keys, urls []string
			for _, item := range got {
				keys = append(keys, item.key)
				urls = append(urls, item.url)
			}
			if !reflect.DeepEqual(keys, tt.wantKeys) {
				t.Fatalf("keys=%v want %v", keys, tt.wantKeys)
			}
			if !reflect.DeepEqual(urls, tt.wantURLs) {
				t.Fatalf("urls=%v want %v", urls, tt.wantURLs)
			}
		})
	}
}
