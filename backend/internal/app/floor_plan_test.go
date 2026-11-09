package app

import (
	"context"
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func TestFloorPlanValidation(t *testing.T) {
	for _, tc := range []struct {
		name       string
		plan       []int
		apartments int
		message    string
	}{
		{"one apartment", []int{1}, 8, ""},
		{"twelve apartments", []int{1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2}, 96, ""},
		{"empty", []int{}, 40, "1-12"},
		{"too many", make([]int, 13), 104, "1-12"},
		{"zero rooms", []int{0}, 8, "1-5"},
		{"negative rooms", []int{-1}, 8, "1-5"},
		{"six rooms", []int{6}, 8, "1-5"},
		{"count mismatch", []int{2, 2}, 40, "Apartment count"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a := testAPI(t)
			b := Building{Name: "Home", Address: "Astana", Entrances: 1, Floors: 9, Apartments: tc.apartments, FloorPlan: tc.plan}
			body, _ := json.Marshal(b)
			code, got := call(t, a, "POST", "/api/v1/buildings", string(body), 1)
			if tc.message == "" {
				if code != 201 || !reflect.DeepEqual(got["floor_plan"], intsAsJSON(tc.plan)) {
					t.Fatal(code, got)
				}
			} else if code != 400 || !strings.Contains(got["error"].(string), tc.message) {
				t.Fatal(code, got)
			}
		})
	}
}

func intsAsJSON(plan []int) []any {
	out := make([]any, len(plan))
	for i, n := range plan {
		out[i] = float64(n)
	}
	return out
}

func TestPatchFloorPlan(t *testing.T) {
	a := testAPI(t)
	for _, user := range []int{0, 2, 3} {
		code, _ := call(t, a, "PATCH", "/api/v1/building", `{"floor_plan":[1,2,3,4,5]}`, user)
		want := 403
		if user == 0 {
			want = 401
		}
		if code != want {
			t.Fatal(user, code)
		}
	}
	a.Store.Update(context.Background(), func(s *State) error {
		b := seedBuilding()
		b.ID = 2
		b.FloorPlan = []int{1, 1, 1, 1, 1}
		s.Buildings = append(s.Buildings, b)
		return nil
	})
	for _, body := range []string{
		`{}`, `{"floor_plan":null}`, `{"floor_plan":[]}`, `{"floor_plan":[2,2]}`,
		`{"floor_plan":[0,1,2,1,3]}`, `{"floor_plan":[6,1,2,1,3]}`,
		`{"floor_plan":[1.5,1,2,1,3]}`,
		`{"floor_plan":[1,2,3,4,5],"building_id":2}`, `{"floor_plan":[1,2,3,4,5],"name":"Changed"}`,
	} {
		if code, got := call(t, a, "PATCH", "/api/v1/building", body, 1); code != 400 {
			t.Fatal(body, code, got)
		}
	}
	code, got := call(t, a, "GET", "/building", "", 1)
	if code != 200 || !reflect.DeepEqual(got["floor_plan"], intsAsJSON([]int{3, 1, 2, 1, 3})) {
		t.Fatal("failed patch changed state", got)
	}
	code, got = call(t, a, "PATCH", "/api/v1/building", `{"floor_plan":[1,2,3,4,5]}`, 1)
	if code != 200 || got["apartments"] != float64(120) {
		t.Fatal(code, got)
	}
	for _, path := range []string{"/api/v1/building", "/api/v1/scene", "/snapshot"} {
		code, got = call(t, a, "GET", path, "", 4)
		if path != "/api/v1/building" {
			got = got["building"].(map[string]any)
		}
		if code != 200 || !reflect.DeepEqual(got["floor_plan"], intsAsJSON([]int{1, 2, 3, 4, 5})) {
			t.Fatal(path, code, got)
		}
	}
	a.Store.View(context.Background(), func(s *State) error {
		if !reflect.DeepEqual(s.Buildings[1].FloorPlan, []int{1, 1, 1, 1, 1}) || len(s.Invites) != 120 {
			t.Fatal("patch changed another building or invites")
		}
		return nil
	})
}

func TestLegacyFloorPlans(t *testing.T) {
	a := testAPI(t)
	s := Seed(a.Now())
	s.Buildings[0].FloorPlan = nil
	s.Buildings = append(s.Buildings,
		Building{ID: 2, Entrances: 2, Floors: 5, Apartments: 24},
		Building{ID: 3, Entrances: 1, Floors: 3, Apartments: 10, FloorPlan: []int{5, 4, 3, 2, 1}},
	)
	a.Store = NewMemory(s)
	check := func(state *State) error {
		for i, want := range [][]int{{3, 1, 2, 1, 3}, {2, 2, 2}, {5, 4, 3, 2, 1}} {
			if !reflect.DeepEqual(state.Buildings[i].FloorPlan, want) || state.Buildings[i].Apartments != s.Buildings[i].Apartments {
				t.Fatal(state.Buildings[i])
			}
		}
		return nil
	}
	if err := a.Store.View(context.Background(), check); err != nil {
		t.Fatal(err)
	}
	if err := a.Store.Update(context.Background(), check); err != nil {
		t.Fatal(err)
	}
	var persisted State
	if err := json.Unmarshal(a.Store.(*Memory).data, &persisted); err != nil {
		t.Fatal(err)
	}
	check(&persisted)
}
