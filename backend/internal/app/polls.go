package app

import (
	"net/http"
	"strings"
	"time"
)

type Vote struct {
	Apartment int `json:"apartment"`
	Option    int `json:"option"`
}
type Poll struct {
	ID         string    `json:"id"`
	BuildingID int       `json:"building_id"`
	Question   string    `json:"question"`
	Options    []string  `json:"options"`
	ClosesAt   time.Time `json:"closes_at"`
	Votes      []Vote    `json:"votes"`
}

func (s *State) pollsFor(u User, now time.Time) []map[string]any {
	out := []map[string]any{}
	for _, p := range s.Polls {
		if p.BuildingID != u.BuildingID {
			continue
		}
		closed := !now.Before(p.ClosesAt)
		apartments := []int{}
		counts := make([]int, len(p.Options))
		my := -1
		for _, v := range p.Votes {
			apartments = append(apartments, v.Apartment)
			counts[v.Option]++
			if v.Apartment == u.Apartment {
				my = v.Option
			}
		}
		v := map[string]any{"id": p.ID, "question": p.Question, "options": p.Options, "closes_at": p.ClosesAt, "closed": closed, "advisory": true, "total_votes": len(p.Votes), "voted_apartments": apartments, "my_vote": my}
		if closed {
			v["results"] = counts
		}
		out = append(out, v)
	}
	return out
}
func (a *API) pollRoutes(m *http.ServeMux) {
	a.route(m, "GET /polls", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		return a.Store.View(r.Context(), func(s *State) error { send(w, 200, s.pollsFor(u, a.Now())); return nil })
	})
	a.route(m, "POST /polls", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		var in struct {
			Question string    `json:"question"`
			Options  []string  `json:"options"`
			ClosesAt time.Time `json:"closes_at"`
		}
		if e := decode(r, &in); e != nil {
			return e
		}
		if len(strings.TrimSpace(in.Question)) < 5 || len(in.Question) > 240 || len(in.Options) < 2 || len(in.Options) > 5 || !in.ClosesAt.After(a.Now()) {
			return bad("Add a question, 2–5 options and a future closing date")
		}
		seen := map[string]bool{}
		for i := range in.Options {
			in.Options[i] = strings.TrimSpace(in.Options[i])
			if in.Options[i] == "" || len(in.Options[i]) > 120 || seen[strings.ToLower(in.Options[i])] {
				return bad("Poll options must be distinct and non-empty")
			}
			seen[strings.ToLower(in.Options[i])] = true
		}
		p := Poll{ID(), u.BuildingID, strings.TrimSpace(in.Question), in.Options, in.ClosesAt, []Vote{}}
		e := a.Store.Update(r.Context(), func(s *State) error { s.Polls = append([]Poll{p}, s.Polls...); return nil })
		if e == nil {
			send(w, 201, map[string]string{"id": p.ID})
		}
		return e
	})
	a.route(m, "POST /polls/{id}/votes", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "resident" {
			return forbidden()
		}
		var in struct {
			Option *int `json:"option"`
		}
		if e := decode(r, &in); e != nil {
			return e
		}
		e := a.Store.Update(r.Context(), func(s *State) error {
			for i := range s.Polls {
				p := &s.Polls[i]
				if p.ID != r.PathValue("id") || p.BuildingID != u.BuildingID {
					continue
				}
				if !a.Now().Before(p.ClosesAt) {
					return failure{409, "This advisory poll has closed"}
				}
				if in.Option == nil || *in.Option < 0 || *in.Option >= len(p.Options) {
					return bad("Choose a valid option")
				}
				for _, v := range p.Votes {
					if v.Apartment == u.Apartment {
						return failure{409, "Your apartment has already voted"}
					}
				}
				p.Votes = append(p.Votes, Vote{u.Apartment, *in.Option})
				return nil
			}
			return notFound()
		})
		if e == nil {
			send(w, 201, map[string]bool{"voted": true})
		}
		return e
	})
	a.route(m, "POST /polls/{id}/close", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		e := a.Store.Update(r.Context(), func(s *State) error {
			for i := range s.Polls {
				if s.Polls[i].ID == r.PathValue("id") && s.Polls[i].BuildingID == u.BuildingID {
					s.Polls[i].ClosesAt = a.Now()
					return nil
				}
			}
			return notFound()
		})
		if e == nil {
			send(w, 200, map[string]bool{"closed": true})
		}
		return e
	})
}
func seedPolls(now time.Time) []Poll {
	open := []Vote{}
	for n := 1; n < 29; n++ {
		if n != 12 {
			open = append(open, Vote{n, n % 2})
		}
	}
	closed := []Vote{}
	for n := 1; n <= 100; n++ {
		option := 0
		if n > 68 {
			option = 1
		}
		closed = append(closed, Vote{n, option})
	}
	return []Poll{{"poll-open", 1, "Install video cameras at entrances?", []string{"Yes, improve safety", "No, keep current setup"}, now.Add(7 * 24 * time.Hour), open}, {"poll-closed", 1, "Add more benches in the courtyard?", []string{"Yes", "No"}, now.Add(-48 * time.Hour), closed}}
}
