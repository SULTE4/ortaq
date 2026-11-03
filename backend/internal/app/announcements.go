package app

import (
	"net/http"
	"strings"
	"time"
)

type Announcement struct {
	ID         string    `json:"id"`
	BuildingID int       `json:"building_id"`
	Title      string    `json:"title"`
	Body       string    `json:"body"`
	At         time.Time `json:"at"`
}

func (s *State) announcementsFor(building int) []Announcement {
	out := []Announcement{}
	for _, v := range s.Announcements {
		if v.BuildingID == building {
			out = append(out, v)
		}
	}
	return out
}
func (a *API) announcementRoutes(m *http.ServeMux) {
	a.route(m, "GET /announcements", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		return a.Store.View(r.Context(), func(s *State) error { send(w, 200, s.announcementsFor(u.BuildingID)); return nil })
	})
	a.route(m, "POST /announcements", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		var in struct {
			Title string `json:"title"`
			Body  string `json:"body"`
		}
		if e := decode(r, &in); e != nil {
			return e
		}
		if len(strings.TrimSpace(in.Title)) < 4 || len(in.Title) > 160 || len(strings.TrimSpace(in.Body)) < 5 || len(in.Body) > 5000 {
			return bad("Add a title (4–160 characters) and message (5–5000 characters)")
		}
		v := Announcement{ID(), u.BuildingID, strings.TrimSpace(in.Title), strings.TrimSpace(in.Body), a.Now()}
		e := a.Store.Update(r.Context(), func(s *State) error {
			s.Announcements = append([]Announcement{v}, s.Announcements...)
			for _, resident := range s.Users {
				if resident.BuildingID == u.BuildingID && resident.Role == "resident" {
					s.notify(resident.ID, u.BuildingID, v.Title, "A new building announcement", "announcement", v.ID, a.Now())
				}
			}
			return nil
		})
		if e == nil {
			send(w, 201, v)
		}
		return e
	})
}
func seedAnnouncements(now time.Time) []Announcement {
	return []Announcement{{"announcement-1", 1, "Water shut-off on Friday", "Scheduled maintenance on the main supply, 10:00–14:00. Please store drinking water in advance. Thank you for your patience.", now.Add(-5 * time.Hour)}, {"announcement-2", 1, "A cleaner courtyard, together", "Our Saturday community clean-up starts at 10:00 by entrance 1. Gloves and bags will be provided. Everyone is welcome.", now.Add(-48 * time.Hour)}, {"announcement-3", 1, "Your monthly report is ready", "All expenses, all receipts. Open Money to see exactly how our building fund was used this month.", now.Add(-72 * time.Hour)}}
}
