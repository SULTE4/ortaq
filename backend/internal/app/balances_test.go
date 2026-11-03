package app

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http/httptest"
	"testing"
)

func importCSV(t *testing.T, a *API, csv string, user int) int {
	t.Helper()
	var b bytes.Buffer
	mw := multipart.NewWriter(&b)
	f, _ := mw.CreateFormFile("file", "balances.csv")
	f.Write([]byte(csv))
	mw.Close()
	r := httptest.NewRequest("POST", "/balances/import", &b)
	r.Header.Set("Content-Type", mw.FormDataContentType())
	r.Header.Set("Authorization", "Bearer "+a.token(User{ID: user}))
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, r)
	return w.Code
}
func TestBalanceAccess(t *testing.T) {
	a := testAPI(t)
	if c, _ := call(t, a, "GET", "/balances", "", 4); c != 403 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "GET", "/balances/me?apartment=87", "", 4); c != 403 {
		t.Fatal(c)
	}
	c, v := call(t, a, "GET", "/balances/me", "", 4)
	if c != 200 || v["apartment"].(float64) != 45 {
		t.Fatal(c, v)
	}
	c, v = call(t, a, "GET", "/snapshot", "", 4)
	if _, ok := v["balances"]; c != 200 || ok {
		t.Fatal("all balances exposed")
	}
	b, _ := json.Marshal(v)
	if bytes.Contains(b, []byte("+77000000013")) {
		t.Fatal("phone leaked")
	}
	if c = importCSV(t, a, "apartment,balance\n45,-24000\n87,18000\n", 4); c != 403 {
		t.Fatal(c)
	}
	if c = importCSV(t, a, "apartment,balance\n45,-24000\n87,18000\n", 2); c != 200 {
		t.Fatal(c)
	}
	if c = importCSV(t, a, "apartment,balance\n45,999\n999,100\n", 2); c != 400 {
		t.Fatal(c)
	}
	a.Store.View(context.Background(), func(s *State) error {
		if s.balanceFor(s.user(4)).Amount != -24000 {
			t.Fatal("partial import")
		}
		return nil
	})
	if c = importCSV(t, a, "apartment,balance\n45,2\n45,3\n", 2); c != 400 {
		t.Fatal(c)
	}
}
