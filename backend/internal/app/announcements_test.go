package app

import (
	"context"
	"testing"
)

func TestAnnouncementFanout(t *testing.T) {
	a := testAPI(t)
	body := `{"title":"Water notice","body":"Shut-off on Friday from 10 to 14"}`
	if c, _ := call(t, a, "POST", "/announcements", body, 2); c != 403 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/announcements", body, 1); c != 201 {
		t.Fatal(c)
	}
	a.Store.View(context.Background(), func(s *State) error {
		for _, id := range []int{3, 4, 5} {
			if len(s.notificationsFor(s.user(id))) != 1 {
				t.Fatal("missing notification", id)
			}
		}
		if len(s.notificationsFor(s.user(2))) != 0 {
			t.Fatal("accountant fanout")
		}
		return nil
	})
}
