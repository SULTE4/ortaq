package app

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestScenePrivacy(t *testing.T) {
	a := testAPI(t)
	for _, id := range []int{3, 4, 5, 2} {
		if c, _ := call(t, a, "GET", "/scene?balances=true", "", id); c != 403 {
			t.Fatal(id, c)
		}
		c, v := call(t, a, "GET", "/scene", "", id)
		if c != 200 {
			t.Fatal(c)
		}
		if _, ok := v["balances"]; ok {
			t.Fatal("private overlay leaked")
		}
		b, _ := json.Marshal(v)
		if strings.Contains(string(b), "+770") {
			t.Fatal("phone leaked into scene")
		}
	}
	c, v := call(t, a, "GET", "/scene?balances=true", "", 1)
	if c != 200 || len(v["balances"].([]any)) != 120 {
		t.Fatal(c, v)
	}
}
func TestEventsAuthAndInitialSnapshot(t *testing.T) {
	a := testAPI(t)
	if c, _ := call(t, a, "GET", "/events", "", 0); c != 401 {
		t.Fatal(c)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	r := httptest.NewRequest("GET", "/events", nil).WithContext(ctx)
	r.Header.Set("Authorization", "Bearer "+a.token(User{ID: 4}))
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, r)
	if w.Header().Get("Content-Type") != "text/event-stream" || !strings.Contains(w.Body.String(), "event: snapshot") {
		t.Fatal(w.Body.String())
	}
}
