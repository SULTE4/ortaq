package app

import (
	"net/http"
	"strings"
	"time"
)

type Feedback struct {
	ID         string    `json:"id"`
	BuildingID int       `json:"building_id"`
	UserID     int       `json:"user_id"`
	Message    string    `json:"message"`
	At         time.Time `json:"at"`
}

func (a *API) feedbackRoutes(m *http.ServeMux) {
	a.route(m, "POST /feedback", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		var in struct {
			Message string `json:"message"`
		}
		if e := decode(r, &in); e != nil {
			return e
		}
		if len(strings.TrimSpace(in.Message)) < 5 || len(in.Message) > 2000 {
			return bad("Share 5–2000 characters of feedback")
		}
		v := Feedback{ID(), u.BuildingID, u.ID, strings.TrimSpace(in.Message), a.Now()}
		e := a.Store.Update(r.Context(), func(s *State) error { s.Feedback = append([]Feedback{v}, s.Feedback...); return nil })
		if e == nil {
			send(w, 201, map[string]bool{"received": true})
		}
		return e
	})
	a.route(m, "GET /feedback", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		return a.Store.View(r.Context(), func(s *State) error {
			out := []Feedback{}
			for _, v := range s.Feedback {
				if v.BuildingID == u.BuildingID {
					out = append(out, v)
				}
			}
			send(w, 200, out)
			return nil
		})
	})
}
