package remnawave

import "testing"

func TestFindUserForAdminCustomer_nilClient(t *testing.T) {
	var c *Client
	_, err := c.FindUserForAdminCustomer(t.Context(), 1, 2, nil, false)
	if err == nil {
		t.Fatal("expected error")
	}
}
