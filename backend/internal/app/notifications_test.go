package app

import (
	"context"
	"testing"
)

func TestPrivateIssueNotifications(t *testing.T) {
	a := testAPI(t)
	_, v := call(t, a, "POST", "/issues", newIssue, 4)
	call(t, a, "PATCH", "/issues/"+v["id"].(string), `{"status":"In Progress","contractor":"Plumber"}`, 1)
	a.Store.View(context.Background(), func(s *State) error {
		if len(s.notificationsFor(s.user(4))) != 1 || len(s.notificationsFor(s.user(3))) != 0 {
			t.Fatal("notification leaked")
		}
		return nil
	})
	call(t, a, "POST", "/notifications/read", `{}`, 3)
	a.Store.View(context.Background(), func(s *State) error {
		if s.Notifications[0].Read {
			t.Fatal("other user marked read")
		}
		return nil
	})
	call(t, a, "POST", "/notifications/read", `{}`, 4)
	a.Store.View(context.Background(), func(s *State) error {
		if !s.Notifications[0].Read {
			t.Fatal("not marked read")
		}
		return nil
	})
}
