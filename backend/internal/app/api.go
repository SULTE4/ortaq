package app

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type API struct {
	Store     Store
	Secret    []byte
	UploadDir string
	Now       func() time.Time
	Demo      bool
}
type failure struct {
	Code    int
	Message string
}

func (e failure) Error() string { return e.Message }
func bad(message string) error  { return failure{400, message} }
func forbidden() error          { return failure{403, "This action is not available for your role"} }
func notFound() error           { return failure{404, "Not found"} }
func ID() string {
	b := make([]byte, 12)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}
func (a *API) token(u User) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload, _ := json.Marshal(map[string]any{"sub": u.ID, "exp": a.Now().Add(12 * time.Hour).Unix()})
	v := header + "." + base64.RawURLEncoding.EncodeToString(payload)
	h := hmac.New(sha256.New, a.Secret)
	h.Write([]byte(v))
	return v + "." + base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}
func (a *API) identity(ctx context.Context, token string) (User, error) {
	var u User
	p := strings.Split(token, ".")
	if len(p) != 3 {
		return u, failure{401, "Please sign in"}
	}
	h := hmac.New(sha256.New, a.Secret)
	h.Write([]byte(p[0] + "." + p[1]))
	sig, e := base64.RawURLEncoding.DecodeString(p[2])
	if e != nil || !hmac.Equal(sig, h.Sum(nil)) {
		return u, failure{401, "Invalid session"}
	}
	head, e := base64.RawURLEncoding.DecodeString(p[0])
	if e != nil || string(head) != `{"alg":"HS256","typ":"JWT"}` {
		return u, failure{401, "Invalid token algorithm"}
	}
	b, e := base64.RawURLEncoding.DecodeString(p[1])
	if e != nil {
		return u, failure{401, "Invalid session"}
	}
	var c struct {
		Sub int   `json:"sub"`
		Exp int64 `json:"exp"`
	}
	if json.Unmarshal(b, &c) != nil || c.Exp <= a.Now().Unix() {
		return u, failure{401, "Session expired"}
	}
	e = a.Store.View(ctx, func(s *State) error { u = s.user(c.Sub); return nil })
	if e != nil {
		return u, e
	}
	if u.ID == 0 {
		return u, failure{401, "Unknown account"}
	}
	return u, nil
}
func decode(r *http.Request, v any) error {
	d := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
	d.DisallowUnknownFields()
	if e := d.Decode(v); e != nil {
		return bad("Invalid request body")
	}
	if d.Decode(new(any)) != io.EOF {
		return bad("Only one JSON object is allowed")
	}
	return nil
}
func send(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

type handler func(http.ResponseWriter, *http.Request, User) error

func (a *API) route(m *http.ServeMux, pattern string, auth bool, h handler) {
	m.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				log.Printf("handler panic: %v", v)
				send(w, 500, map[string]string{"error": "Internal server error"})
			}
		}()
		var u User
		var e error
		if auth {
			u, e = a.identity(r.Context(), strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		}
		if e == nil {
			e = h(w, r, u)
		}
		if e != nil {
			var f failure
			if errors.As(e, &f) {
				send(w, f.Code, map[string]string{"error": f.Message})
			} else {
				log.Print(e)
				send(w, 500, map[string]string{"error": "Could not complete request"})
			}
		}
	})
}
func (a *API) Handler() http.Handler {
	m := http.NewServeMux()
	a.route(m, "GET /health", false, func(w http.ResponseWriter, r *http.Request, u User) error {
		if e := a.Store.View(r.Context(), func(s *State) error { return nil }); e != nil {
			return e
		}
		send(w, 200, map[string]bool{"ok": true})
		return nil
	})
	a.route(m, "POST /auth/otp", false, a.otp)
	a.route(m, "POST /auth/verify", false, a.verify)
	a.route(m, "GET /me", true, func(w http.ResponseWriter, r *http.Request, u User) error { send(w, 200, u); return nil })
	a.route(m, "GET /building", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		return a.Store.View(r.Context(), func(s *State) error { send(w, 200, s.building(u.BuildingID)); return nil })
	})
	a.routes(m)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowedOrigin(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 12<<20)
		m.ServeHTTP(w, r)
	})
}
func allowedOrigin(s string) bool {
	for _, p := range []string{"8081", "8082", "8083", "5173"} {
		for _, host := range []string{"localhost", "127.0.0.1"} {
			if s == "http://"+host+":"+p {
				return true
			}
		}
	}
	return false
}

var phonePattern = regexp.MustCompile(`^\+7[0-9]{10}$`)

func (a *API) otp(w http.ResponseWriter, r *http.Request, u User) error {
	if !a.Demo {
		return failure{503, "OTP provider not configured; this server only supports explicit demo mode"}
	}
	var in struct {
		Phone string `json:"phone"`
	}
	if e := decode(r, &in); e != nil {
		return e
	}
	if !phonePattern.MatchString(in.Phone) {
		return bad("Use a Kazakhstan phone number, for example +77000000012")
	}
	e := a.Store.Update(r.Context(), func(s *State) error {
		if s.Challenges == nil {
			s.Challenges = map[string]Challenge{}
		}
		for p, c := range s.Challenges {
			if c.Expires.Before(a.Now()) {
				delete(s.Challenges, p)
			}
		}
		if c, ok := s.Challenges[in.Phone]; ok && c.Expires.After(a.Now().Add(4*time.Minute+30*time.Second)) {
			return failure{429, "Wait 30 seconds before requesting another code"}
		}
		s.Challenges[in.Phone] = Challenge{Expires: a.Now().Add(5 * time.Minute)}
		return nil
	})
	if e == nil {
		send(w, 200, map[string]string{"message": "Demo code: 1234"})
	}
	return e
}
func (a *API) verify(w http.ResponseWriter, r *http.Request, _ User) error {
	var in struct {
		Phone  string `json:"phone"`
		Code   string `json:"code"`
		Invite string `json:"invite"`
		Name   string `json:"name"`
	}
	if e := decode(r, &in); e != nil {
		return e
	}
	var u User
	var authError error
	e := a.Store.Update(r.Context(), func(s *State) error {
		c, ok := s.Challenges[in.Phone]
		if !ok || !c.Expires.After(a.Now()) || c.Attempts >= 5 || !a.Demo {
			authError = failure{401, "Request a new code"}
			return nil
		}
		if in.Code != "1234" {
			c.Attempts++
			s.Challenges[in.Phone] = c
			authError = failure{401, "Incorrect code"}
			return nil
		}
		for _, v := range s.Users {
			if v.Phone == in.Phone {
				u = v
				delete(s.Challenges, in.Phone)
				return nil
			}
		}
		var invite Invite
		for _, v := range s.Invites {
			if v.Code == strings.ToUpper(strings.TrimSpace(in.Invite)) && !v.Revoked {
				invite = v
			}
		}
		if invite.Code == "" {
			return bad("Enter a valid apartment invite code")
		}
		name := strings.TrimSpace(in.Name)
		if name == "" {
			name = "New neighbour"
		}
		if len(name) > 80 {
			return bad("Name is too long")
		}
		u = User{len(s.Users) + 1, in.Phone, name, "resident", invite.BuildingID, invite.Apartment}
		s.Users = append(s.Users, u)
		delete(s.Challenges, in.Phone)
		return nil
	})
	if e != nil {
		return e
	}
	if authError != nil {
		return authError
	}
	send(w, 200, map[string]any{"token": a.token(u), "user": u})
	return nil
}
func (a *API) routes(m *http.ServeMux) {
	a.buildingRoutes(m)
	a.reportRoutes(m)
	a.issueRoutes(m)
	a.workflowRoutes(m)
}

var _ = fmt.Sprintf
