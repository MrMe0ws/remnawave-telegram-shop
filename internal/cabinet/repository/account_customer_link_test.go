package repository

import (
	"errors"
	"testing"
)

// Текст ошибки — как её отдаёт pgx/v4 при нарушении FK по account_id.
const fkAccountErrText = `ERROR: insert or update on table "cabinet_account_customer_link" ` +
	`violates foreign key constraint "cabinet_account_customer_link_account_id_fkey" (SQLSTATE 23503)`

func TestIsAccountFKViolation(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"account fk", errors.New(fkAccountErrText), true},
		{
			// FK по customer_id — это другой сбой, аккаунт тут ни при чём.
			name: "customer fk",
			err: errors.New(`ERROR: insert or update on table "cabinet_account_customer_link" ` +
				`violates foreign key constraint "cabinet_account_customer_link_customer_id_fkey" (SQLSTATE 23503)`),
			want: false,
		},
		{
			name: "unique violation",
			err: errors.New(`ERROR: duplicate key value violates unique constraint ` +
				`"cabinet_account_customer_link_account_id_key" (SQLSTATE 23505)`),
			want: false,
		},
		{"unrelated", errors.New("connection reset by peer"), false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isAccountFKViolation(tc.err); got != tc.want {
				t.Fatalf("isAccountFKViolation(%v) = %v, want %v", tc.err, got, tc.want)
			}
		})
	}
}
