package app

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

func TestEntrancePlansValidation(t *testing.T) {
	for _, tc := range []struct {
		name, plans        string
		apartments, status int
	}{
		{"legacy default", `{}`, 120, 201},
		{"override", `{"3":[3,2,2,2,3]}`, 120, 201},
		{"different lengths", `{"1":[1],"3":[5,2]}`, 64, 201},
		{"twelve flats", `{"2":[1,2,3,4,5,1,2,3,4,5,1,2]}`, 176, 201},
		{"wrong sum", `{"3":[2,2]}`, 120, 400},
		{"zero entrance", `{"0":[2]}`, 88, 400},
		{"missing entrance", `{"4":[2]}`, 120, 400},
		{"non canonical", `{"03":[2]}`, 120, 400},
		{"negative entrance", `{"-1":[2]}`, 120, 400},
		{"text entrance", `{"north":[2]}`, 120, 400},
		{"empty plan", `{"3":[]}`, 80, 400},
		{"null plan", `{"3":null}`, 80, 400},
		{"too many flats", `{"3":[1,1,1,1,1,1,1,1,1,1,1,1,1]}`, 184, 400},
		{"zero rooms", `{"3":[0]}`, 88, 400},
		{"six rooms", `{"3":[6]}`, 88, 400},
		{"fraction rooms", `{"3":[2.5]}`, 88, 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a := testAPI(t)
			body := `{"name":"Home","address":"Astana","entrances":3,"floors":9,"floor_plan":[3,1,2,1,3],"entrance_plans":` + tc.plans + `,"apartments":` + stringJSON(tc.apartments) + `}`
			code, got := call(t, a, "POST", "/api/v1/buildings", body, 1)
			if code != tc.status {
				t.Fatal(code, got)
			}
		})
	}
}

func stringJSON(v any) string { b, _ := json.Marshal(v); return string(b) }

func TestPatchEntrancePlansAndIsolation(t *testing.T) {
	a := testAPI(t)
	a.Store.Update(context.Background(), func(s *State) error {
		other := seedBuilding()
		other.ID = 2
		s.Buildings = append(s.Buildings, other)
		return nil
	})
	for _, user := range []int{0, 2, 3} {
		want := 403
		if user == 0 {
			want = 401
		}
		if c, b := call(t, a, "PATCH", "/building", `{"entrance_plans":{}}`, user); c != want {
			t.Fatal(c, b)
		}
	}
	for _, body := range []string{
		`{"entrance_plans":null}`, `{"apartments":null}`, `{"entrance_plans":{"4":[2]}}`,
		`{"entrance_plans":{"3":[2]}}`, `{"entrance_plans":[]}`, `{"apartments":0}`,
		`{"apartments":501}`, `{"apartments":120.5}`, `{"entrance_plans":{"03":[3,2,2,2,3]}}`,
	} {
		if c, b := call(t, a, "PATCH", "/building", body, 1); c != 400 {
			t.Fatal(body, c, b)
		}
	}
	for _, body := range []string{
		`{"entrance_plans":{"2":[1,2],"3":[3,2,2,2,3]},"apartments":96}`,
		`{"floor_plan":[1,2,3],"apartments":80}`,
		`{"entrance_plans":{},"apartments":72}`,
		`{"apartments":72}`,
		`{"floor_plan":[3,1,2,1,3],"entrance_plans":{"3":[3,2,2,2,3]},"apartments":120}`,
		`{"entrance_plans":{}}`,
	} {
		if c, b := call(t, a, "PATCH", "/api/v1/building", body, 1); c != 200 {
			t.Fatal(body, c, b)
		}
	}
	for _, path := range []string{"/building", "/api/v1/scene", "/snapshot"} {
		c, b := call(t, a, "GET", path, "", 4)
		if path != "/building" {
			b = b["building"].(map[string]any)
		}
		if c != 200 || b["apartments"] != float64(120) || b["entrance_plans"] != nil {
			t.Fatal(path, c, b)
		}
	}
	a.Store.View(context.Background(), func(s *State) error {
		if !reflect.DeepEqual(s.Buildings[1].EntrancePlans, seedBuilding().EntrancePlans) || len(s.Invites) != 120 || s.Users[3].Apartment != 45 {
			t.Fatal("patch changed another building, invites or resident numbers")
		}
		return nil
	})
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/buildings/map", nil))
	if w.Code != 200 || strings.Contains(w.Body.String(), "entrance_plans") {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestEntrancePlanImagesKeysAndAccess(t *testing.T) {
	a := testAPI(t)
	pdf := []byte("%PDF-1.4\nfixture")
	for _, key := range []string{"3:0", "3%3A1", "3-2"} {
		c, b := planUpload(t, a, key, pdf, 1)
		canonical := strings.ReplaceAll(strings.ReplaceAll(key, "%3A", ":"), "-", ":")
		url := planURL(t, c, b, canonical)
		if !strings.HasPrefix(url, "/api/v1/media/1/plan-3-") {
			t.Fatal(url)
		}
		if c, _ := call(t, a, "GET", url, "", 5); c != 200 {
			t.Fatal(c)
		}
	}
	for _, key := range []string{"1:0", "4:0", "3:5", "03:0", "3:01", "3:-1", "3:0:1", "0:0", "3--1"} {
		if c, b := planUpload(t, a, key, pdf, 1); c != 400 {
			t.Fatal(key, c, b)
		}
		if c, b := call(t, a, "DELETE", "/building/plans/"+key, "", 1); c != 400 {
			t.Fatal(key, c, b)
		}
	}
	for _, user := range []int{0, 2, 3, 5} {
		want := 403
		if user == 0 {
			want = 401
		}
		if c, b := planUpload(t, a, "3:0", pdf, user); c != want {
			t.Fatal(c, b)
		}
		if c, b := call(t, a, "DELETE", "/building/plans/3:0", "", user); c != want {
			t.Fatal(c, b)
		}
	}
	a.Store.Update(context.Background(), func(s *State) error {
		other := seedBuilding()
		other.ID = 2
		s.Buildings = append(s.Buildings, other)
		s.Users = append(s.Users, User{ID: 6, Role: "chairman", BuildingID: 2})
		return nil
	})
	c, b := planUpload(t, a, "3-0", pdf, 6)
	other := planURL(t, c, b, "3:0")
	if c, _ := call(t, a, "GET", other, "", 1); c != 403 {
		t.Fatal(c)
	}
	if c, b := call(t, a, "DELETE", "/building/plans/3%3A0", "", 1); c != 200 {
		t.Fatal(c, b)
	}
	if c, _ := call(t, a, "GET", other, "", 6); c != 200 {
		t.Fatal("delete crossed buildings", c)
	}
}

func TestEntrancePlanImagesDropRules(t *testing.T) {
	a := testAPI(t)
	urls := map[string]string{}
	for _, key := range []string{"0", "1", "4", "3:0", "3:1", "3:4"} {
		c, b := planUpload(t, a, key, []byte("%PDF-1.4\nfixture"), 1)
		urls[key] = planURL(t, c, b, key)
	}
	check := func(body string, keep []string) {
		t.Helper()
		c, b := call(t, a, "PATCH", "/building", body, 1)
		if c != 200 {
			t.Fatal(c, b)
		}
		images := b["plan_images"].(map[string]any)
		if len(images) != len(keep) {
			t.Fatal(images, keep)
		}
		for _, key := range keep {
			if images[key] != urls[key] {
				t.Fatal(key, images)
			}
		}
	}
	// Default edits do not change an entrance's own documents.
	check(`{"floor_plan":[2,1,2,1,3]}`, []string{"1", "4", "3:0", "3:1", "3:4"})
	// Changed override rooms drop only that key.
	check(`{"entrance_plans":{"3":[3,1,2,2,3]}}`, []string{"1", "4", "3:0", "3:4"})
	// Shrinking drops removed positions, preserving valid default positions.
	check(`{"entrance_plans":{"3":[3,1]},"apartments":96}`, []string{"1", "4", "3:0"})
	// {} replaces overrides and drops every entrance-specific image.
	check(`{"entrance_plans":{},"apartments":120}`, []string{"1", "4"})
	for _, key := range []string{"0", "3:0", "3:1", "3:4"} {
		if c, _ := call(t, a, "GET", urls[key], "", 4); c != 404 {
			t.Fatal("stale file retained", key, c)
		}
	}
}

func TestEntrancePlansLegacyAndSeed(t *testing.T) {
	a := testAPI(t)
	seed := seedBuilding()
	if !reflect.DeepEqual(seed.EntrancePlans, map[string][]int{"3": {3, 2, 2, 2, 3}}) || seed.Apartments != 120 {
		t.Fatal(seed)
	}
	state := Seed(a.Now())
	state.Buildings[0].EntrancePlans = nil
	a.Store = NewMemory(state)
	for _, body := range []string{`{"floor_plan":[3,1,2,1,3]}`, `{"entrance_plans":{}}`} {
		if c, b := call(t, a, "PATCH", "/building", body, 1); c != 200 || b["entrance_plans"] != nil {
			t.Fatal(c, b)
		}
	}
	a.Store = NewMemory(state)
	c, b := planUpload(t, a, "4", []byte("%PDF-1.4\nfixture"), 1)
	planURL(t, c, b, "4")
	if c, _ := planUpload(t, a, "3:0", []byte("%PDF-1.4\nfixture"), 1); c != 400 {
		t.Fatal(c)
	}
}

func TestEntrancePlanImagesFailedPatch(t *testing.T) {
	a := testAPI(t)
	c, b := planUpload(t, a, "3:1", []byte("%PDF-1.4\noriginal"), 1)
	url := planURL(t, c, b, "3:1")
	a.Store = rejectedPlanStore{a.Store}
	if c, _ := call(t, a, "PATCH", "/building", `{"entrance_plans":{}}`, 1); c != 500 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "GET", url, "", 4); c != 200 {
		t.Fatal("failed patch removed file", c)
	}
	c, b = call(t, a, "GET", "/building", "", 4)
	if c != 200 || b["plan_images"].(map[string]any)["3:1"] != url {
		t.Fatal(c, b)
	}
}
