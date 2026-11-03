package app

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func testAPI(t *testing.T) *API {
	t.Helper()
	return &API{Store: NewMemory(Seed(time.Now())), Secret: []byte("a-test-secret-with-at-least-32-bytes"), UploadDir: t.TempDir(), Now: time.Now, Demo: true}
}
func call(t *testing.T, a *API, method, path, body string, u int) (int, map[string]any) {
	t.Helper()
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	if u > 0 {
		r.Header.Set("Authorization", "Bearer "+a.token(User{ID: u}))
	}
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, r)
	var v map[string]any
	json.Unmarshal(w.Body.Bytes(), &v)
	return w.Code, v
}
func TestAuth(t *testing.T) {
	a := testAPI(t)
	if c, _ := call(t, a, "GET", "/me", "", 0); c != 401 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/auth/otp", `{"phone":"+77000000099"}`, 0); c != 200 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/auth/verify", `{"phone":"+77000000099","code":"0000"}`, 0); c != 401 {
		t.Fatal(c)
	}
	c, v := call(t, a, "POST", "/auth/verify", `{"phone":"+77000000099","code":"1234","invite":"ORTAQ-045"}`, 0)
	if c != 200 {
		t.Fatal(c, v)
	}
	token := v["token"].(string)
	u, e := a.identity(context.Background(), token)
	if e != nil || u.Role != "resident" || u.Apartment != 45 {
		t.Fatal(u, e)
	}
	if _, e = a.identity(context.Background(), token+"x"); e == nil {
		t.Fatal("forged token accepted")
	}
	a.Now = func() time.Time { return time.Now().Add(13 * time.Hour) }
	if _, e = a.identity(context.Background(), token); e == nil {
		t.Fatal("expired token accepted")
	}
}
func TestAuthAttemptLimit(t *testing.T) {
	a := testAPI(t)
	call(t, a, "POST", "/auth/otp", `{"phone":"+77000000012"}`, 0)
	for i := 0; i < 5; i++ {
		call(t, a, "POST", "/auth/verify", `{"phone":"+77000000012","code":"9999"}`, 0)
	}
	if c, _ := call(t, a, "POST", "/auth/verify", `{"phone":"+77000000012","code":"1234"}`, 0); c != 401 {
		t.Fatal(c)
	}
}
