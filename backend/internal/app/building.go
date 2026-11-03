package app

import (
	"fmt"
	"net/http"
	"strings"
)

func (a *API) buildingRoutes(m *http.ServeMux) {
	a.route(m, "POST /buildings", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		var in Building
		if e := decode(r, &in); e != nil {
			return e
		}
		if strings.TrimSpace(in.Name) == "" || strings.TrimSpace(in.Address) == "" || len(in.Name) > 120 || len(in.Address) > 240 || in.Apartments < 1 || in.Apartments > 500 || in.Entrances < 1 || in.Entrances > 10 || in.Floors < 1 || in.Floors > 50 {
			return bad("Enter a name, address, 1–500 apartments, 1–10 entrances and 1–50 floors")
		}
		e := a.Store.Update(r.Context(), func(s *State) error {
			in.ID = len(s.Buildings) + 1
			s.Buildings = append(s.Buildings, in)
			for i := range s.Users {
				if s.Users[i].ID == u.ID {
					s.Users[i].BuildingID = in.ID
				}
			}
			for n := 1; n <= in.Apartments; n++ {
				s.Invites = append(s.Invites, Invite{ID(), in.ID, n, false})
			}
			return nil
		})
		if e == nil {
			send(w, 201, in)
		}
		return e
	})
	a.route(m, "GET /invites", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		return a.Store.View(r.Context(), func(s *State) error {
			out := []Invite{}
			for _, i := range s.Invites {
				if i.BuildingID == u.BuildingID {
					out = append(out, i)
				}
			}
			send(w, 200, out)
			return nil
		})
	})
	a.route(m, "POST /invites", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		var in struct {
			Apartment int `json:"apartment"`
		}
		if e := decode(r, &in); e != nil {
			return e
		}
		var invite Invite
		e := a.Store.Update(r.Context(), func(s *State) error {
			if in.Apartment < 1 || in.Apartment > s.building(u.BuildingID).Apartments {
				return bad("Apartment is outside this building")
			}
			for i := range s.Invites {
				if s.Invites[i].BuildingID == u.BuildingID && s.Invites[i].Apartment == in.Apartment {
					s.Invites[i].Revoked = true
				}
			}
			invite = Invite{strings.ToUpper(ID()), u.BuildingID, in.Apartment, false}
			s.Invites = append(s.Invites, invite)
			return nil
		})
		if e == nil {
			send(w, 201, invite)
		}
		return e
	})
	a.route(m, "POST /invites/{code}/revoke", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		e := a.Store.Update(r.Context(), func(s *State) error {
			for i := range s.Invites {
				if s.Invites[i].BuildingID == u.BuildingID && s.Invites[i].Code == r.PathValue("code") {
					s.Invites[i].Revoked = true
					return nil
				}
			}
			return notFound()
		})
		if e == nil {
			send(w, 200, map[string]bool{"revoked": true})
		}
		return e
	})
}
func seedInvites() []Invite {
	out := []Invite{}
	for n := 1; n <= 120; n++ {
		out = append(out, Invite{fmt.Sprintf("ORTAQ-%03d", n), 1, n, false})
	}
	return out
}
