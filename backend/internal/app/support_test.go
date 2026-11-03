package app

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestApartmentSupport(t *testing.T) {
	a := testAPI(t)
	if c, _ := call(t, a, "POST", "/issues/issue-01/support", `{}`, 3); c != 200 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/issues/issue-01/support", `{}`, 3); c != 409 {
		t.Fatal(c)
	}
	a.Store.Update(context.Background(), func(s *State) error {
		s.Users = append(s.Users, User{6, "+77000000099", "Same apartment", "resident", 1, 12})
		return nil
	})
	if c, _ := call(t, a, "POST", "/issues/issue-01/support", `{}`, 6); c != 409 {
		t.Fatal("same apartment duplicate", c)
	}
	if c, _ := call(t, a, "POST", "/issues/issue-03/support", `{}`, 3); c != 400 {
		t.Fatal(c)
	}
	r := httptest.NewRequest("GET", "/issues/similar?category=Heating&entrance=2&floor=5", nil)
	r.Header.Set("Authorization", "Bearer "+a.token(User{ID: 3}))
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, r)
	var out []Issue
	if e := json.Unmarshal(w.Body.Bytes(), &out); e != nil || len(out) != 1 {
		t.Fatal(e, w.Body.String())
	}
}
