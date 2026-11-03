package app

import (
	"net/http"
	"regexp"
	"strings"
	"time"
)

type Expense struct {
	ID          string `json:"id"`
	Category    string `json:"category"`
	Amount      int64  `json:"amount"`
	Date        string `json:"date"`
	Receipt     string `json:"receipt"`
	Description string `json:"description"`
}
type Correction struct {
	Note     string    `json:"note"`
	At       time.Time `json:"at"`
	By       int       `json:"by"`
	Expenses []Expense `json:"expenses"`
}
type Report struct {
	ID          string       `json:"id"`
	BuildingID  int          `json:"building_id"`
	Month       string       `json:"month"`
	Expenses    []Expense    `json:"expenses"`
	PublishedAt time.Time    `json:"published_at"`
	Corrections []Correction `json:"corrections"`
}

var categories = []string{"Cleaning", "Elevator", "Security", "Utilities", "Repairs", "Salary"}
var monthPattern = regexp.MustCompile(`^20[0-9]{2}-(0[1-9]|1[0-2])$`)

func effective(r Report) []Expense {
	if len(r.Corrections) > 0 {
		return r.Corrections[len(r.Corrections)-1].Expenses
	}
	return r.Expenses
}
func validExpenses(month string, items []Expense) error {
	if !monthPattern.MatchString(month) || len(items) == 0 || len(items) > 100 {
		return bad("Select a month and add 1–100 expenses")
	}
	for i := range items {
		v := &items[i]
		valid := false
		for _, c := range categories {
			if c == v.Category {
				valid = true
			}
		}
		d, e := time.Parse("2006-01-02", v.Date)
		if !valid || v.Amount <= 0 || v.Amount > 1000000000 || e != nil || d.Format("2006-01") != month || !validPhoto(v.Receipt) || len(v.Description) > 300 {
			return bad("Every expense needs a category, positive whole KZT amount, date in the report month and uploaded receipt")
		}
		if v.ID == "" {
			v.ID = ID()
		}
	}
	return nil
}
func (s *State) reportsFor(building int) []Report {
	out := []Report{}
	for _, v := range s.Reports {
		if v.BuildingID == building {
			out = append(out, v)
		}
	}
	return out
}
func (a *API) reportRoutes(m *http.ServeMux) {
	a.route(m, "GET /reports", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		return a.Store.View(r.Context(), func(s *State) error { send(w, 200, s.reportsFor(u.BuildingID)); return nil })
	})
	a.route(m, "GET /snapshot", true, a.snapshot)
	a.route(m, "POST /reports", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" && u.Role != "accountant" {
			return forbidden()
		}
		var in struct {
			Month    string    `json:"month"`
			Expenses []Expense `json:"expenses"`
		}
		if e := decode(r, &in); e != nil {
			return e
		}
		if e := validExpenses(in.Month, in.Expenses); e != nil {
			return e
		}
		if e := a.checkPhotos(u, in.Expenses); e != nil {
			return e
		}
		report := Report{ID(), u.BuildingID, in.Month, in.Expenses, a.Now(), []Correction{}}
		e := a.Store.Update(r.Context(), func(s *State) error {
			for _, v := range s.Reports {
				if v.BuildingID == u.BuildingID && v.Month == in.Month {
					return failure{409, "This month is already published. Add a visible correction instead"}
				}
			}
			s.Reports = append([]Report{report}, s.Reports...)
			return nil
		})
		if e == nil {
			send(w, 201, report)
		}
		return e
	})
	a.route(m, "POST /reports/{id}/corrections", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" && u.Role != "accountant" {
			return forbidden()
		}
		var in struct {
			Note     string    `json:"note"`
			Expenses []Expense `json:"expenses"`
		}
		if e := decode(r, &in); e != nil {
			return e
		}
		in.Note = strings.TrimSpace(in.Note)
		if len(in.Note) < 5 || len(in.Note) > 1000 {
			return bad("Explain the correction in 5–1000 characters")
		}
		if e := a.checkPhotos(u, in.Expenses); e != nil {
			return e
		}
		e := a.Store.Update(r.Context(), func(s *State) error {
			for i := range s.Reports {
				v := &s.Reports[i]
				if v.ID == r.PathValue("id") && v.BuildingID == u.BuildingID {
					if e := validExpenses(v.Month, in.Expenses); e != nil {
						return e
					}
					v.Corrections = append(v.Corrections, Correction{in.Note, a.Now(), u.ID, in.Expenses})
					return nil
				}
			}
			return notFound()
		})
		if e == nil {
			send(w, 200, map[string]bool{"corrected": true})
		}
		return e
	})
	a.uploadRoutes(m)
}
func (a *API) snapshot(w http.ResponseWriter, r *http.Request, u User) error {
	return a.Store.View(r.Context(), func(s *State) error {
		data := map[string]any{"me": u, "building": s.building(u.BuildingID), "reports": s.reportsFor(u.BuildingID)}
		send(w, 200, data)
		return nil
	})
}
func seedReports(now time.Time) []Report {
	out := []Report{}
	base := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	for n := 1; n <= 3; n++ {
		month := base.AddDate(0, -n, 0).Format("2006-01")
		items := []Expense{}
		amounts := []int64{240000, 180000, 420000, 310000, 260000, 350000}
		for c, cat := range categories {
			total := amounts[c] + int64((n-1)*c*5000)
			for j := 0; j < 3; j++ {
				amount := total / 3
				if j == 2 {
					amount += total % 3
				}
				items = append(items, Expense{ID(), cat, amount, month + []string{"-05", "-15", "-25"}[j], "/media/seed/receipt.png", cat + " · Astana service invoice"})
			}
		}
		out = append(out, Report{ID(), 1, month, items, base.AddDate(0, -n+1, 0), []Correction{}})
	}
	return out
}
