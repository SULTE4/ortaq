package app

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var planMediaPattern = regexp.MustCompile(`^/media/[1-9][0-9]*/plan-(?:[1-9][0-9]*-)?[0-9]+-[a-f0-9]+\.(png|jpg|webp|pdf)$`)

func (a *API) removePlanFile(building int, url string) {
	path := strings.TrimPrefix(url, "/api/v1")
	if !planMediaPattern.MatchString(path) || !strings.HasPrefix(path, fmt.Sprintf("/media/%d/", building)) {
		return
	}
	if err := os.Remove(filepath.Join(a.UploadDir, fmt.Sprint(building), filepath.Base(path))); err != nil && !os.IsNotExist(err) {
		log.Printf("remove replaced floor plan: %v", err)
	}
}

func (a *API) planRoutes(m *http.ServeMux) {
	for _, method := range []string{"POST", "DELETE"} {
		a.route(m, method+" /building/plans/{position}", true, func(w http.ResponseWriter, r *http.Request, u User) error {
			if u.Role != "chairman" {
				return forbidden()
			}
			key := r.PathValue("position")
			if strings.Count(key, "-") == 1 && !strings.Contains(key, ":") {
				key = strings.ReplaceAll(key, "-", ":")
			}
			// Validate before reading the file, and again inside the serialized update.
			if err := a.Store.View(r.Context(), func(s *State) error {
				b := s.building(u.BuildingID)
				if b.ID == 0 {
					return notFound()
				}
				if _, ok := b.planRooms(key); !ok {
					return bad("Choose an existing typical floor key: position or entrance:position")
				}
				return nil
			}); err != nil {
				return err
			}
			var data []byte
			var name string
			if r.Method == "POST" {
				if err := r.ParseMultipartForm(10 << 20); err != nil {
					return bad("Choose a PNG, JPEG, WebP or PDF up to 10 MB")
				}
				defer r.MultipartForm.RemoveAll()
				file, _, err := r.FormFile("file")
				if err != nil {
					return bad("A floor plan file is required")
				}
				defer file.Close()
				data, err = io.ReadAll(io.LimitReader(file, (10<<20)+1))
				if err != nil || len(data) > 10<<20 {
					return bad("Maximum floor plan size is 10 MB")
				}
				ext := map[string]string{"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf"}[http.DetectContentType(data)]
				if ext == "" {
					return bad("Only PNG, JPEG, WebP and PDF floor plans are supported")
				}
				name = fmt.Sprintf("plan-%s-%s.%s", strings.ReplaceAll(key, ":", "-"), ID(), ext)
			}
			var updated Building
			var previous string
			err := a.Store.Update(r.Context(), func(s *State) error {
				for i := range s.Buildings {
					b := &s.Buildings[i]
					if b.ID != u.BuildingID {
						continue
					}
					if _, ok := b.planRooms(key); !ok {
						return bad("Choose an existing typical floor key: position or entrance:position")
					}
					previous = b.PlanImages[key]
					if r.Method == "POST" {
						dir := filepath.Join(a.UploadDir, fmt.Sprint(u.BuildingID))
						if err := os.MkdirAll(dir, 0755); err != nil {
							return err
						}
						if err := os.WriteFile(filepath.Join(dir, name), data, 0644); err != nil {
							return err
						}
						b.PlanImages[key] = fmt.Sprintf("/api/v1/media/%d/%s", u.BuildingID, name)
					} else {
						delete(b.PlanImages, key)
					}
					updated = *b
					return nil
				}
				return notFound()
			})
			if err != nil {
				if name != "" {
					a.removePlanFile(u.BuildingID, fmt.Sprintf("/api/v1/media/%d/%s", u.BuildingID, name))
				}
				return err
			}
			a.removePlanFile(u.BuildingID, previous)
			send(w, 200, updated)
			return nil
		})
	}
}
