package app

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"testing"
)

func TestUploadedPhotosAndScope(t *testing.T) {
	a := testAPI(t)
	upload := func(data []byte) (int, map[string]any) {
		var body bytes.Buffer
		mw := multipart.NewWriter(&body)
		f, _ := mw.CreateFormFile("file", "photo.png")
		f.Write(data)
		mw.Close()
		r := httptest.NewRequest("POST", "/uploads", &body)
		r.Header.Set("Content-Type", mw.FormDataContentType())
		r.Header.Set("Authorization", "Bearer "+a.token(User{ID: 4}))
		w := httptest.NewRecorder()
		a.Handler().ServeHTTP(w, r)
		v := map[string]any{}
		json.Unmarshal(w.Body.Bytes(), &v)
		return w.Code, v
	}
	if c, _ := upload([]byte("<svg onload='alert(1)'>")); c != 400 {
		t.Fatal(c)
	}
	png, e := os.ReadFile(a.UploadDir + "/seed/issue.png")
	if e != nil {
		t.Fatal(e)
	}
	c, v := upload(png)
	if c != 201 {
		t.Fatal(c, v)
	}
	path := v["url"].(string)
	if c, _ := call(t, a, "GET", path, "", 0); c != 401 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "GET", path, "", 3); c != 200 {
		t.Fatal(c)
	}
	a.Store.Update(context.Background(), func(s *State) error { s.Users[2].BuildingID = 2; return nil })
	if c, _ := call(t, a, "GET", path, "", 3); c != 403 {
		t.Fatal("cross-building media leaked", c)
	}
}
func TestSeedReportArithmetic(t *testing.T) {
	a := testAPI(t)
	s := Seed(a.Now())
	if len(s.Reports) != 3 {
		t.Fatal("expected 3 months")
	}
	for i, r := range s.Reports {
		var sum int64
		for _, e := range r.Expenses {
			sum += e.Amount
		}
		if len(r.Expenses) != 18 || sum != 1760000+int64(i)*75000 {
			t.Fatal(i, sum, len(r.Expenses))
		}
	}
}
func TestMissingVoteIsRejected(t *testing.T) {
	a := testAPI(t)
	if c, _ := call(t, a, "POST", "/polls/poll-open/votes", `{}`, 4); c != 400 {
		t.Fatal(c)
	}
}
