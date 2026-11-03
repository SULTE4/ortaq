package app

import (
	"net/http"
	"strconv"
)

func (a *API) supportRoutes(m *http.ServeMux) {
	a.route(m, "POST /issues/{id}/support", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "resident" {
			return forbidden()
		}
		var out Issue
		e := a.Store.Update(r.Context(), func(s *State) error {
			for i := range s.Issues {
				v := &s.Issues[i]
				if v.ID != r.PathValue("id") || v.BuildingID != u.BuildingID {
					continue
				}
				if v.Status == "Resolved" {
					return bad("This issue is already resolved")
				}
				for _, apt := range v.Supporters {
					if apt == u.Apartment {
						return failure{409, "Your apartment already supports this issue"}
					}
				}
				v.Supporters = append(v.Supporters, u.Apartment)
				out = *v
				return nil
			}
			return notFound()
		})
		if e == nil {
			send(w, 200, out)
		}
		return e
	})
	a.route(m, "GET /issues/similar", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		entrance, _ := strconv.Atoi(r.URL.Query().Get("entrance"))
		floor, _ := strconv.Atoi(r.URL.Query().Get("floor"))
		location := Location{entrance, floor, r.URL.Query().Get("area")}
		return a.Store.View(r.Context(), func(s *State) error {
			out := []Issue{}
			for _, v := range s.issuesFor(u.BuildingID) {
				if v.Status != "Resolved" && v.Category == r.URL.Query().Get("category") && v.Location == location {
					out = append(out, v)
				}
			}
			send(w, 200, out)
			return nil
		})
	})
}
