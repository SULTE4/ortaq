package app

import (
	"net/http"
	"strings"
)

func (a *API) workflowRoutes(m *http.ServeMux) {
	a.route(m, "PATCH /issues/{id}", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		var in struct {
			Status      string `json:"status"`
			Contractor  string `json:"contractor"`
			ResultPhoto string `json:"result_photo"`
			Note        string `json:"note"`
		}
		if e := decode(r, &in); e != nil {
			return e
		}
		in.Contractor = strings.TrimSpace(in.Contractor)
		if len(in.Contractor) > 100 || len(in.Note) > 500 {
			return bad("Contractor or note is too long")
		}
		if in.Status == "Resolved" {
			if e := a.checkPhoto(u, in.ResultPhoto); e != nil {
				return bad("Resolving an issue requires an uploaded result photo")
			}
		}
		var out Issue
		e := a.Store.Update(r.Context(), func(s *State) error {
			for i := range s.Issues {
				v := &s.Issues[i]
				if v.ID != r.PathValue("id") || v.BuildingID != u.BuildingID {
					continue
				}
				from := v.Status
				if !(from == "New" && in.Status == "In Progress" || from == "In Progress" && in.Status == "Resolved" || from == "Resolved" && in.Status == "In Progress" || from == in.Status) {
					return bad("Move New → In Progress → Resolved. Resolved issues can be reopened")
				}
				if in.Status == "In Progress" && in.Contractor == "" {
					return bad("Assign a contractor before starting work")
				}
				if from == in.Status && v.Contractor == in.Contractor {
					return bad("Choose a new status or contractor")
				}
				v.Status = in.Status
				v.Contractor = in.Contractor
				if in.Status == "Resolved" {
					v.ResultPhoto = in.ResultPhoto
				}
				note := strings.TrimSpace(in.Note)
				if note == "" {
					note = "Updated by the chairman"
				}
				if in.Contractor != "" {
					note += " · " + in.Contractor
				}
				v.History = append(v.History, History{in.Status, a.Now(), note, in.ResultPhoto})
				if from != in.Status {
					s.notify(v.Reporter, v.BuildingID, "Your issue is "+in.Status, v.Title, "issue", v.ID, a.Now())
				}
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
}
