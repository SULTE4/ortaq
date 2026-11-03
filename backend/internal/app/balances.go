package app

import (
	"encoding/csv"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Balance struct {
	BuildingID int       `json:"building_id"`
	Apartment  int       `json:"apartment"`
	Amount     int64     `json:"amount"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (s *State) balanceFor(u User) Balance {
	for _, b := range s.Balances {
		if b.BuildingID == u.BuildingID && b.Apartment == u.Apartment {
			return b
		}
	}
	return Balance{BuildingID: u.BuildingID, Apartment: u.Apartment}
}
func (s *State) balancesFor(building int) []Balance {
	out := []Balance{}
	for _, b := range s.Balances {
		if b.BuildingID == building {
			out = append(out, b)
		}
	}
	return out
}
func (a *API) balanceRoutes(m *http.ServeMux) {
	a.route(m, "GET /balances/me", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "resident" {
			return forbidden()
		}
		if apt := r.URL.Query().Get("apartment"); apt != "" && apt != strconv.Itoa(u.Apartment) {
			return forbidden()
		}
		return a.Store.View(r.Context(), func(s *State) error { send(w, 200, s.balanceFor(u)); return nil })
	})
	a.route(m, "GET /balances", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" && u.Role != "accountant" {
			return forbidden()
		}
		return a.Store.View(r.Context(), func(s *State) error { send(w, 200, s.balancesFor(u.BuildingID)); return nil })
	})
	a.route(m, "POST /balances/import", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" && u.Role != "accountant" {
			return forbidden()
		}
		if e := r.ParseMultipartForm(2 << 20); e != nil {
			return bad("Upload a CSV under 2 MB")
		}
		defer r.MultipartForm.RemoveAll()
		f, header, e := r.FormFile("file")
		if e != nil {
			return bad("Attach a CSV file")
		}
		defer f.Close()
		if header.Size > 2<<20 {
			return bad("CSV exceeds 2 MB")
		}
		reader := csv.NewReader(io.LimitReader(f, 2<<20+1))
		rows, e := reader.ReadAll()
		if e != nil || len(rows) < 2 || len(rows) > 501 || len(rows[0]) != 2 || strings.TrimPrefix(strings.TrimSpace(rows[0][0]), "\uFEFF") != "apartment" || strings.TrimSpace(rows[0][1]) != "balance" {
			return bad("CSV header must be apartment,balance with 1–500 data rows")
		}
		count := 0
		e = a.Store.Update(r.Context(), func(s *State) error {
			incoming := map[int]int64{}
			for _, row := range rows[1:] {
				if len(row) != 2 {
					return bad("Each CSV row needs apartment and balance")
				}
				apt, e1 := strconv.Atoi(strings.TrimSpace(row[0]))
				amount, e2 := strconv.ParseInt(strings.TrimSpace(row[1]), 10, 64)
				if e1 != nil || e2 != nil || apt < 1 || apt > s.building(u.BuildingID).Apartments || amount < -1000000000 || amount > 1000000000 {
					return bad("CSV contains an invalid apartment or whole KZT amount")
				}
				if _, ok := incoming[apt]; ok {
					return bad("CSV contains duplicate apartments")
				}
				incoming[apt] = amount
			}
			for apt, amount := range incoming {
				found := false
				for i := range s.Balances {
					if s.Balances[i].BuildingID == u.BuildingID && s.Balances[i].Apartment == apt {
						s.Balances[i].Amount = amount
						s.Balances[i].UpdatedAt = a.Now()
						found = true
					}
				}
				if !found {
					s.Balances = append(s.Balances, Balance{u.BuildingID, apt, amount, a.Now()})
				}
			}
			count = len(incoming)
			return nil
		})
		if e == nil {
			send(w, 200, map[string]int{"imported": count})
		}
		return e
	})
}
func seedBalances(now time.Time) []Balance {
	out := []Balance{}
	for n := 1; n <= 120; n++ {
		amount := int64(0)
		if n%7 == 0 {
			amount = -int64(12000 + n*125)
		} else if n%5 == 0 {
			amount = 18000
		}
		out = append(out, Balance{1, n, amount, now.Add(-24 * time.Hour)})
	}
	return out
}
