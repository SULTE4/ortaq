package app

import (
	"net/http"
	"time"
)

type Notification struct {
	ID         string    `json:"id"`
	UserID     int       `json:"user_id"`
	BuildingID int       `json:"building_id"`
	Title      string    `json:"title"`
	Body       string    `json:"body"`
	Kind       string    `json:"kind"`
	RelatedID  string    `json:"related_id"`
	Read       bool      `json:"read"`
	At         time.Time `json:"at"`
}

func (s *State) notify(user, building int, title, body, kind, related string, at time.Time) {
	s.Notifications = append([]Notification{{ID(), user, building, title, body, kind, related, false, at}}, s.Notifications...)
}
func (s *State) notificationsFor(u User) []Notification {
	out := []Notification{}
	for _, n := range s.Notifications {
		if n.UserID == u.ID && n.BuildingID == u.BuildingID {
			out = append(out, n)
		}
	}
	return out
}
func (a *API) notificationRoutes(m *http.ServeMux) {
	a.route(m, "GET /notifications", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		return a.Store.View(r.Context(), func(s *State) error { send(w, 200, s.notificationsFor(u)); return nil })
	})
	a.route(m, "POST /notifications/read", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		e := a.Store.Update(r.Context(), func(s *State) error {
			for i := range s.Notifications {
				if s.Notifications[i].UserID == u.ID && s.Notifications[i].BuildingID == u.BuildingID {
					s.Notifications[i].Read = true
				}
			}
			return nil
		})
		if e == nil {
			send(w, 200, map[string]bool{"read": true})
		}
		return e
	})
}
