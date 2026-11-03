package app

import (
	"context"
	"testing"
)

func TestStatusWorkflow(t *testing.T) {
	a := testAPI(t)
	_, issue := call(t, a, "POST", "/issues", newIssue, 4)
	path := "/issues/" + issue["id"].(string)
	for _, body := range []string{`{"status":"Resolved","result_photo":"/media/seed/result.png"}`, `{"status":"In Progress"}`, `{"status":"Invalid"}`} {
		if c, _ := call(t, a, "PATCH", path, body, 1); c != 400 {
			t.Fatal(c, body)
		}
	}
	if c, _ := call(t, a, "PATCH", path, `{"status":"In Progress","contractor":"Astana Plumbing"}`, 4); c != 403 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "PATCH", path, `{"status":"In Progress","contractor":"Astana Plumbing"}`, 1); c != 200 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "PATCH", path, `{"status":"Resolved","contractor":"Astana Plumbing"}`, 1); c != 400 {
		t.Fatal(c)
	}
	if c, v := call(t, a, "PATCH", path, `{"status":"Resolved","contractor":"Astana Plumbing","result_photo":"/media/seed/result.png"}`, 1); c != 200 {
		t.Fatal(c, v)
	}
	a.Store.View(context.Background(), func(s *State) error {
		if len(s.Issues[0].History) != 3 || s.Issues[0].Status != "Resolved" {
			t.Fatal(s.Issues[0])
		}
		return nil
	})
}
