package app

import (
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Location struct {
	Entrance int    `json:"entrance"`
	Floor    int    `json:"floor"`
	Area     string `json:"area"`
}
type History struct {
	Status string    `json:"status"`
	At     time.Time `json:"at"`
	Note   string    `json:"note"`
	Photo  string    `json:"photo"`
}
type Issue struct {
	ID          string    `json:"id"`
	BuildingID  int       `json:"building_id"`
	Reporter    int       `json:"reporter"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	Location    Location  `json:"location"`
	Photo       string    `json:"photo"`
	Status      string    `json:"status"`
	Contractor  string    `json:"contractor"`
	ResultPhoto string    `json:"result_photo"`
	History     []History `json:"history"`
	Supporters  []int     `json:"supporters"`
	CreatedAt   time.Time `json:"created_at"`
}

var issueCategories = []string{"Heating", "Plumbing", "Elevator", "Cleaning", "Lighting", "Safety", "Other"}

func (s *State) issuesFor(building int) []Issue {
	out := []Issue{}
	for _, v := range s.Issues {
		if v.BuildingID == building {
			out = append(out, v)
		}
	}
	return out
}
func (a *API) issueRoutes(m *http.ServeMux) {
	a.route(m, "POST /issues", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "resident" {
			return forbidden()
		}
		var in struct {
			Title       string   `json:"title"`
			Description string   `json:"description"`
			Category    string   `json:"category"`
			Location    Location `json:"location"`
			Photo       string   `json:"photo"`
		}
		if e := decode(r, &in); e != nil {
			return e
		}
		if len(strings.TrimSpace(in.Title)) < 4 || len(in.Title) > 160 || len(strings.TrimSpace(in.Description)) < 5 || len(in.Description) > 2000 {
			return bad("Add a title (4–160 characters) and description (5–2000 characters)")
		}
		valid := false
		for _, c := range issueCategories {
			if c == in.Category {
				valid = true
			}
		}
		if !valid {
			return bad("Choose an issue category")
		}
		if e := a.checkPhoto(u, in.Photo); e != nil {
			return e
		}
		var issue Issue
		e := a.Store.Update(r.Context(), func(s *State) error {
			b := s.building(u.BuildingID)
			l := in.Location
			if l.Area == "" {
				if l.Entrance < 1 || l.Entrance > b.Entrances || l.Floor < 1 || l.Floor > b.Floors {
					return bad("Choose an entrance and floor in your building")
				}
			} else {
				found := false
				for _, area := range []string{"Courtyard", "Playground", "Parking", "Gate"} {
					if area == l.Area {
						found = true
					}
				}
				if !found || l.Entrance != 0 || l.Floor != 0 {
					return bad("Choose a common area without an entrance or floor")
				}
			}
			issue = Issue{ID: ID(), BuildingID: u.BuildingID, Reporter: u.ID, Title: strings.TrimSpace(in.Title), Description: strings.TrimSpace(in.Description), Category: in.Category, Location: l, Photo: in.Photo, Status: "New", History: []History{{"New", a.Now(), "Reported by a resident", in.Photo}}, Supporters: []int{}, CreatedAt: a.Now()}
			s.Issues = append([]Issue{issue}, s.Issues...)
			return nil
		})
		if e == nil {
			send(w, 201, issue)
		}
		return e
	})
	a.route(m, "GET /issues", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		return a.Store.View(r.Context(), func(s *State) error { send(w, 200, s.issuesFor(u.BuildingID)); return nil })
	})
}
func seedIssues(now time.Time) []Issue {
	titles := []string{"Cold radiator in entrance 2", "Elevator door closes too quickly", "Lamp out on floor 3", "Snow at the courtyard gate", "Leaking pipe near entrance", "Playground swing needs repair", "Stairwell cleaning request", "Intercom audio is quiet", "Parking light flickering", "Heating pipe insulated"}
	cats := []string{"Heating", "Elevator", "Lighting", "Cleaning", "Plumbing", "Safety", "Cleaning", "Other", "Lighting", "Heating"}
	out := []Issue{}
	for i, title := range titles {
		status := []string{"New", "In Progress", "Resolved"}[i%3]
		l := Location{i%3 + 1, i%9 + 1, ""}
		if i == 0 {
			l = Location{2, 2, ""}
		}
		if i == 3 {
			l = Location{0, 0, "Gate"}
		}
		if i == 5 {
			l = Location{0, 0, "Playground"}
		}
		at := now.Add(-time.Duration(24*(i+1)) * time.Hour)
		h := []History{{"New", at, "Reported by a resident", "/media/seed/issue.png"}}
		contractor, result := "", ""
		if status != "New" {
			contractor = []string{"Astana Lift", "Qamqor Service", "Taza House"}[i%3]
			h = append(h, History{"In Progress", at.Add(4 * time.Hour), "Assigned to " + contractor, ""})
		}
		if status == "Resolved" {
			result = "/media/seed/result.png"
			h = append(h, History{"Resolved", at.Add(48 * time.Hour), "Work completed and photographed", result})
		}
		supporters := []int{}
		for n := 0; n < i%5; n++ {
			supporters = append(supporters, 20+n)
		}
		out = append(out, Issue{fmt.Sprintf("issue-%02d", i+1), 1, 4, title, "Please check this shared building issue. Photo and exact location are attached.", cats[i], l, "/media/seed/issue.png", status, contractor, result, h, supporters, at})
	}
	return out
}
