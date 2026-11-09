package app

import (
	"context"
	"testing"
)

func TestBuildingIsolation(t *testing.T) {
	a := testAPI(t)
	var reportID string
	a.Store.Update(context.Background(), func(s *State) error {
		reportID = s.Reports[0].ID
		s.Buildings = append(s.Buildings, Building{ID: 2, Name: "Other home", Address: "Astana", Entrances: 1, Floors: 9, Apartments: 40})
		s.Users[0].BuildingID = 2
		s.Users[2].BuildingID = 2
		return nil
	})
	c, v := call(t, a, "GET", "/snapshot", "", 3)
	if c != 200 {
		t.Fatal(c)
	}
	for _, key := range []string{"reports", "issues", "announcements", "polls", "notifications"} {
		if len(v[key].([]any)) != 0 {
			t.Fatal("cross-building data", key)
		}
	}
	if c, _ := call(t, a, "PATCH", "/issues/issue-01", `{"status":"In Progress","contractor":"Plumber"}`, 1); c != 404 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/polls/poll-open/votes", `{"option":0}`, 3); c != 404 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/reports/"+reportID+"/corrections", `{"note":"A visible correction","expenses":[]}`, 1); c != 404 {
		t.Fatal(c)
	}
}
