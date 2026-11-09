package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func planUpload(t *testing.T, a *API, position string, data []byte, user int) (int, map[string]any) {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	f, _ := mw.CreateFormFile("file", "untrusted.html")
	f.Write(data)
	mw.Close()
	r := httptest.NewRequest("POST", "/api/v1/building/plans/"+position, &body)
	r.Header.Set("Content-Type", mw.FormDataContentType())
	if user > 0 {
		r.Header.Set("Authorization", "Bearer "+a.token(User{ID: user}))
	}
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, r)
	v := map[string]any{}
	json.Unmarshal(w.Body.Bytes(), &v)
	return w.Code, v
}
func planURL(t *testing.T, code int, b map[string]any, position string) string {
	t.Helper()
	if code != 200 {
		t.Fatal(code, b)
	}
	return b["plan_images"].(map[string]any)[position].(string)
}
func TestPlanImagesTypesAndAccess(t *testing.T) {
	a := testAPI(t)
	var pngBytes, jpegBytes bytes.Buffer
	png.Encode(&pngBytes, image.NewRGBA(image.Rect(0, 0, 10, 10)))
	jpeg.Encode(&jpegBytes, image.NewRGBA(image.Rect(0, 0, 10, 10)), nil)
	// Minimal WebP signature exercises the same content sniffer as photo uploads.
	webp := []byte("RIFF\x14\x00\x00\x00WEBPVP8 \x08\x00\x00\x00fixture")
	for _, tc := range []struct {
		ext, mime string
		data      []byte
	}{
		{"png", "image/png", pngBytes.Bytes()}, {"jpg", "image/jpeg", jpegBytes.Bytes()},
		{"webp", "image/webp", webp}, {"pdf", "application/pdf", []byte("%PDF-1.4\nfixture\n%%EOF")},
	} {
		t.Run(tc.ext, func(t *testing.T) {
			code, b := planUpload(t, a, "4", tc.data, 1)
			url := planURL(t, code, b, "4")
			if !strings.HasPrefix(url, "/api/v1/media/1/plan-4-") || !strings.HasSuffix(url, "."+tc.ext) {
				t.Fatal(url)
			}
			r := httptest.NewRequest("GET", url, nil)
			r.Header.Set("Authorization", "Bearer "+a.token(User{ID: 4}))
			w := httptest.NewRecorder()
			a.Handler().ServeHTTP(w, r)
			if w.Code != 200 || w.Header().Get("Content-Type") != tc.mime || !bytes.Equal(w.Body.Bytes(), tc.data) {
				t.Fatal(w.Code, w.Header(), w.Body.String())
			}
			if code, _ := call(t, a, "GET", url, "", 0); code != 401 {
				t.Fatal(code)
			}
			for _, route := range []string{"/api/v1/building", "/v1/building", "/building", "/api/v1/scene", "/snapshot"} {
				code, b := call(t, a, "GET", route, "", 4)
				if route == "/api/v1/scene" || route == "/snapshot" {
					b, _ = b["building"].(map[string]any)
				}
				if code != 200 || b["plan_images"].(map[string]any)["4"] != url {
					t.Fatal(route, code, b)
				}
			}
		})
	}
	for _, user := range []int{0, 2, 3, 4} {
		want := 403
		if user == 0 {
			want = 401
		}
		if c, _ := planUpload(t, a, "4", pngBytes.Bytes(), user); c != want {
			t.Fatal(user, c)
		}
		if c, _ := call(t, a, "DELETE", "/api/v1/building/plans/4", "", user); c != want {
			t.Fatal(user, c)
		}
	}
	if validPhoto("/media/1/plan-4-abcd.pdf") {
		t.Fatal("PDF accepted as issue photo")
	}
}
func TestPlanImagesValidation(t *testing.T) {
	a := testAPI(t)
	pdf := []byte("%PDF-1.4\nfixture")
	for _, position := range []string{"-1", "5", "100", "x", "01", "+1"} {
		if c, _ := planUpload(t, a, position, pdf, 1); c != 400 {
			t.Fatal(position, c)
		}
		if c, _ := call(t, a, "DELETE", "/building/plans/"+position, "", 1); c != 400 {
			t.Fatal(position, c)
		}
	}
	for _, data := range [][]byte{nil, []byte("<svg onload='alert(1)'>"), []byte("not a PNG"), append(pdf, make([]byte, 10<<20)...)} {
		if c, _ := planUpload(t, a, "0", data, 1); c != 400 {
			t.Fatal(c)
		}
	}
	atLimit := make([]byte, 10<<20)
	copy(atLimit, pdf)
	c, b := planUpload(t, a, "0", atLimit, 1)
	planURL(t, c, b, "0")
	if c, _ := call(t, a, "POST", "/building/plans/0", "", 1); c != 400 {
		t.Fatal(c)
	}
	if c, b := call(t, a, "GET", "/building", "", 1); c != 200 || len(b["plan_images"].(map[string]any)) != 1 {
		t.Fatal(c, b)
	}
	if c, b := call(t, a, "POST", "/buildings", `{"name":"Home","address":"Astana","entrances":1,"floors":3,"apartments":10,"floor_plan":[3,1,2,1,3],"plan_images":{"4":"/api/v1/media/1/plan-4-abcd.pdf"}}`, 1); c != 400 {
		t.Fatal(c, b)
	}
}
func TestPlanImagesReplaceDeleteAndIsolation(t *testing.T) {
	a := testAPI(t)
	pdf := []byte("%PDF-1.4\nfixture")
	c, b := planUpload(t, a, "4", pdf, 1)
	old := planURL(t, c, b, "4")
	c, b = planUpload(t, a, "4", pdf, 1)
	current := planURL(t, c, b, "4")
	if current == old {
		t.Fatal("replacement reused URL")
	}
	if c, _ := call(t, a, "GET", old, "", 4); c != 404 {
		t.Fatal("old file retained", c)
	}
	a.Store.Update(context.Background(), func(s *State) error {
		second := seedBuilding()
		second.ID = 2
		s.Buildings = append(s.Buildings, second)
		s.Users = append(s.Users, User{ID: 6, Role: "chairman", BuildingID: 2})
		return nil
	})
	if c, _ := call(t, a, "GET", current, "", 6); c != 403 {
		t.Fatal(c)
	}
	c, b = planUpload(t, a, "4", pdf, 6)
	other := planURL(t, c, b, "4")
	if !strings.HasPrefix(other, "/api/v1/media/2/") {
		t.Fatal(other)
	}
	if c, _ := call(t, a, "DELETE", "/building/plans/4", "", 6); c != 200 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "GET", current, "", 4); c != 200 {
		t.Fatal("other building removed our plan", c)
	}
	c, b = call(t, a, "DELETE", "/api/v1/building/plans/4", "", 1)
	if c != 200 || len(b["plan_images"].(map[string]any)) != 0 {
		t.Fatal(c, b)
	}
	if c, _ := call(t, a, "GET", current, "", 4); c != 404 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "DELETE", "/building/plans/4", "", 1); c != 200 {
		t.Fatal(c)
	}
	entries, _ := os.ReadDir(filepath.Join(a.UploadDir, "1"))
	if len(entries) != 0 {
		t.Fatal(entries)
	}
	// Public projection must never expose a plan URL.
	c, b = planUpload(t, a, "4", pdf, 1)
	url := planURL(t, c, b, "4")
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/buildings/map", nil))
	if w.Code != 200 || strings.Contains(w.Body.String(), "plan_images") || strings.Contains(w.Body.String(), url) {
		t.Fatal(w.Body.String())
	}
}
func TestPlanImagesDropOnFloorChange(t *testing.T) {
	a := testAPI(t)
	urls := map[string]string{}
	for _, p := range []string{"0", "1", "4"} {
		c, b := planUpload(t, a, p, []byte("%PDF-1.4\nfixture"), 1)
		urls[p] = planURL(t, c, b, p)
	}
	if c, _ := call(t, a, "PATCH", "/building", `{"floor_plan":[2,1]}`, 1); c != 400 {
		t.Fatal(c)
	}
	for _, url := range urls {
		if c, _ := call(t, a, "GET", url, "", 4); c != 200 {
			t.Fatal("failed patch lost file", c)
		}
	}
	c, b := call(t, a, "PATCH", "/building", `{"floor_plan":[2,1,2,1,3]}`, 1)
	plans := b["plan_images"].(map[string]any)
	if c != 200 || len(plans) != 2 || plans["1"] != urls["1"] || plans["4"] != urls["4"] {
		t.Fatal(c, b)
	}
	if c, _ := call(t, a, "GET", urls["0"], "", 4); c != 404 {
		t.Fatal(c)
	}
	// Legacy stale positions are dropped on the next valid plan update.
	a.Store.Update(context.Background(), func(s *State) error { s.Buildings[0].PlanImages["9"] = "/api/v1/media/1/plan-9-abcd.pdf"; return nil })
	c, b = call(t, a, "PATCH", "/building", `{"floor_plan":[2,1,2,1,3]}`, 1)
	if c != 200 || len(b["plan_images"].(map[string]any)) != 2 {
		t.Fatal(c, fmt.Sprint(b))
	}
}

type rejectedPlanStore struct{ Store }

func (s rejectedPlanStore) Update(ctx context.Context, f func(*State) error) error {
	return s.Store.Update(ctx, func(state *State) error {
		if err := f(state); err != nil {
			return err
		}
		return fmt.Errorf("fixture rejected persistence")
	})
}

func TestPlanImagesFailedWritePreservesPrevious(t *testing.T) {
	a := testAPI(t)
	c, b := planUpload(t, a, "4", []byte("%PDF-1.4\noriginal"), 1)
	old := planURL(t, c, b, "4")
	store := a.Store
	a.Store = rejectedPlanStore{store}
	if c, _ := planUpload(t, a, "4", []byte("%PDF-1.4\nreplacement"), 1); c != 500 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "DELETE", "/building/plans/4", "", 1); c != 500 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "PATCH", "/building", `{"floor_plan":[3,1,2,1,2]}`, 1); c != 500 {
		t.Fatal(c)
	}
	c, b = call(t, a, "GET", "/building", "", 1)
	if c != 200 || b["plan_images"].(map[string]any)["4"] != old {
		t.Fatal(c, b)
	}
	if c, _ := call(t, a, "GET", old, "", 4); c != 200 {
		t.Fatal(c)
	}
	entries, err := os.ReadDir(filepath.Join(a.UploadDir, "1"))
	if err != nil || len(entries) != 1 {
		t.Fatal("failed upload left a file", entries, err)
	}
	// A filesystem error must not replace the published document either.
	a.Store = store
	originalDir := a.UploadDir
	a.UploadDir = filepath.Join(t.TempDir(), "a-file")
	if err := os.WriteFile(a.UploadDir, []byte("fixture"), 0644); err != nil {
		t.Fatal(err)
	}
	if c, _ := planUpload(t, a, "4", []byte("%PDF-1.4\nreplacement"), 1); c != 500 {
		t.Fatal(c)
	}
	a.UploadDir = originalDir
	c, b = call(t, a, "GET", "/building", "", 1)
	if c != 200 || b["plan_images"].(map[string]any)["4"] != old {
		t.Fatal(c, b)
	}
}
