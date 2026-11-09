package app

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var photoPattern = regexp.MustCompile(`^/media/(seed|[1-9][0-9]*)/[a-zA-Z0-9_-]+\.(png|jpg|webp)$`)

func validPhoto(v string) bool { return photoPattern.MatchString(v) }
func (a *API) checkPhoto(u User, v string) error {
	if !validPhoto(v) {
		return bad("Upload a photo first")
	}
	parts := strings.Split(v, "/")
	if parts[2] != "seed" && parts[2] != fmt.Sprint(u.BuildingID) {
		return forbidden()
	}
	if _, e := os.Stat(filepath.Join(a.UploadDir, parts[2], parts[3])); e != nil {
		return bad("Photo is missing; upload it again")
	}
	return nil
}
func (a *API) checkPhotos(u User, items []Expense) error {
	for _, v := range items {
		if e := a.checkPhoto(u, v.Receipt); e != nil {
			return e
		}
	}
	return nil
}
func (a *API) uploadRoutes(m *http.ServeMux) {
	a.route(m, "POST /uploads", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if e := r.ParseMultipartForm(10 << 20); e != nil {
			return bad("Choose a PNG, JPEG or WebP under 10 MB")
		}
		defer r.MultipartForm.RemoveAll()
		f, _, e := r.FormFile("file")
		if e != nil {
			return bad("A photo is required")
		}
		defer f.Close()
		b, e := io.ReadAll(io.LimitReader(f, 10<<20+1))
		if e != nil || len(b) > 10<<20 {
			return bad("Maximum photo size is 10 MB")
		}
		ext := map[string]string{"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[http.DetectContentType(b)]
		if ext == "" {
			return bad("Only PNG, JPEG and WebP photos are supported")
		}
		dir := filepath.Join(a.UploadDir, fmt.Sprint(u.BuildingID))
		if e = os.MkdirAll(dir, 0755); e != nil {
			return e
		}
		name := ID() + "." + ext
		if e = os.WriteFile(filepath.Join(dir, name), b, 0644); e != nil {
			return e
		}
		send(w, 201, map[string]string{"url": fmt.Sprintf("/media/%d/%s", u.BuildingID, name)})
		return nil
	})
	a.route(m, "GET /media/{building}/{name}", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		path := "/media/" + r.PathValue("building") + "/" + r.PathValue("name")
		if !validPhoto(path) && !planMediaPattern.MatchString(path) {
			return notFound()
		}
		if r.PathValue("building") != "seed" && r.PathValue("building") != fmt.Sprint(u.BuildingID) {
			return forbidden()
		}
		w.Header().Set("Cache-Control", "private, max-age=3600")
		http.ServeFile(w, r, filepath.Join(a.UploadDir, r.PathValue("building"), r.PathValue("name")))
		return nil
	})
}

// Demo images are generated locally: the finished application has no image CDN dependency.
func SeedImages(dir string) error {
	seed := filepath.Join(dir, "seed")
	if e := os.MkdirAll(seed, 0755); e != nil {
		return e
	}
	for _, kind := range []string{"receipt", "issue", "result"} {
		img := image.NewRGBA(image.Rect(0, 0, 640, 440))
		bg := color.RGBA{235, 240, 247, 255}
		if kind == "receipt" {
			bg = color.RGBA{252, 250, 242, 255}
		}
		for y := 0; y < 440; y++ {
			for x := 0; x < 640; x++ {
				v := bg
				if kind == "receipt" && x > 65 && x < 575 && ((y > 55 && y < 88) || (y > 130 && y < 355 && (y%33) < 5)) {
					v = color.RGBA{36, 59, 85, 255}
				}
				if kind != "receipt" && ((x/65)%2 == 0 && y > 60 && y < 370) {
					v = color.RGBA{100, 130, 158, 255}
				}
				if kind == "result" && x > 400 && y > 260 {
					v = color.RGBA{50, 180, 140, 255}
				}
				img.SetRGBA(x, y, v)
			}
		}
		var b bytes.Buffer
		if e := png.Encode(&b, img); e != nil {
			return e
		}
		if e := os.WriteFile(filepath.Join(seed, kind+".png"), b.Bytes(), 0644); e != nil {
			return e
		}
	}
	return nil
}
