package app

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func (a *API) sceneData(s *State, u User, balances bool) map[string]any {
	out := map[string]any{"building": s.building(u.BuildingID), "issues": s.issuesFor(u.BuildingID), "reports": s.reportsFor(u.BuildingID), "announcements": s.announcementsFor(u.BuildingID), "polls": s.pollsFor(u, a.Now()), "role": u.Role, "apartment": u.Apartment}
	if balances && u.Role == "chairman" {
		out["balances"] = s.balancesFor(u.BuildingID)
	}
	return out
}
func (a *API) sceneRoutes(m *http.ServeMux) {
	a.route(m, "GET /scene", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		balances := r.URL.Query().Get("balances") == "true"
		if balances && u.Role != "chairman" {
			return forbidden()
		}
		return a.Store.View(r.Context(), func(s *State) error { send(w, 200, a.sceneData(s, u, balances)); return nil })
	})
	a.route(m, "GET /events", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		balances := r.URL.Query().Get("balances") == "true"
		if balances && u.Role != "chairman" {
			return forbidden()
		}
		f, ok := w.(http.Flusher)
		if !ok {
			return failure{500, "Streaming unavailable"}
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Accel-Buffering", "no")
		var previous [32]byte
		tick := time.NewTicker(3 * time.Second)
		defer tick.Stop()
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		for {
			user, e := a.identity(r.Context(), token)
			if e != nil || balances && user.Role != "chairman" {
				return nil
			}
			var body []byte
			e = a.Store.View(r.Context(), func(s *State) error { var e error; body, e = json.Marshal(a.sceneData(s, user, balances)); return e })
			if e != nil {
				return nil
			}
			hash := sha256.Sum256(body)
			if hash != previous {
				if _, e = fmt.Fprintf(w, "event: snapshot\ndata: %s\n\n", body); e != nil {
					return nil
				}
				previous = hash
			} else {
				if _, e = fmt.Fprint(w, ": heartbeat\n\n"); e != nil {
					return nil
				}
			}
			f.Flush()
			select {
			case <-r.Context().Done():
				return nil
			case <-tick.C:
			}
		}
	})
}
