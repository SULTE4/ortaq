package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

func validateRooms(plan []int) error {
	if len(plan) < 1 || len(plan) > 12 {
		return bad("Typical floor must contain 1-12 apartments")
	}
	for _, rooms := range plan {
		if rooms < 1 || rooms > 5 {
			return bad("Each apartment must have 1-5 rooms")
		}
	}
	return nil
}

func (b Building) planFor(entrance int) []int {
	if plan, ok := b.EntrancePlans[strconv.Itoa(entrance)]; ok {
		return plan
	}
	return b.FloorPlan
}

func (b Building) validateFloorPlan() error {
	if err := validateRooms(b.FloorPlan); err != nil {
		return err
	}
	for key, plan := range b.EntrancePlans {
		entrance, err := strconv.Atoi(key)
		if err != nil || strconv.Itoa(entrance) != key || entrance < 1 || entrance > b.Entrances {
			return bad("Entrance plan keys must be existing entrance numbers (1-based)")
		}
		if err := validateRooms(plan); err != nil {
			return err
		}
	}
	total := 0
	for entrance := 1; entrance <= b.Entrances; entrance++ {
		total += (b.Floors - 1) * len(b.planFor(entrance))
	}
	if b.Entrances < 1 || b.Floors < 2 || b.Apartments != total {
		return bad("Apartment count must equal the sum over entrances of (floors - 1) x apartments in that entrance's typical floor; floor 1 is shops and lobbies")
	}
	return nil
}

// JSON keys are canonical; the route also accepts e-p as an alias for e:p.
func (b Building) planRooms(key string) (int, bool) {
	parts := strings.Split(key, ":")
	plan := b.FloorPlan
	if len(parts) == 2 {
		entrance, err := strconv.Atoi(parts[0])
		if err != nil || strconv.Itoa(entrance) != parts[0] || entrance < 1 || entrance > b.Entrances {
			return 0, false
		}
		var ok bool
		plan, ok = b.EntrancePlans[parts[0]]
		if !ok {
			return 0, false
		}
	} else if len(parts) != 1 {
		return 0, false
	}
	position, err := strconv.Atoi(parts[len(parts)-1])
	if err != nil || strconv.Itoa(position) != parts[len(parts)-1] || position < 0 || position >= len(plan) {
		return 0, false
	}
	return plan[position], true
}

func (a *API) buildingRoutes(m *http.ServeMux) {
	a.planRoutes(m)
	a.route(m, "PATCH /building", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		var in struct {
			FloorPlan     json.RawMessage `json:"floor_plan"`
			EntrancePlans json.RawMessage `json:"entrance_plans"`
			Apartments    json.RawMessage `json:"apartments"`
		}
		if e := decode(r, &in); e != nil {
			return e
		}
		var updated Building
		var removed []string
		e := a.Store.Update(r.Context(), func(s *State) error {
			for i := range s.Buildings {
				if s.Buildings[i].ID != u.BuildingID {
					continue
				}
				updated = s.Buildings[i]
				if len(in.FloorPlan) != 0 {
					updated.FloorPlan = nil
				}
				if len(in.EntrancePlans) != 0 {
					updated.EntrancePlans = nil
				}
				if len(in.FloorPlan) == 0 && len(in.EntrancePlans) == 0 && len(in.Apartments) == 0 {
					return bad("Supply floor_plan, entrance_plans or apartments")
				}
				for _, field := range []struct {
					raw    json.RawMessage
					target any
				}{
					{in.FloorPlan, &updated.FloorPlan}, {in.EntrancePlans, &updated.EntrancePlans}, {in.Apartments, &updated.Apartments},
				} {
					if len(field.raw) == 0 {
						continue
					}
					if string(field.raw) == "null" || json.Unmarshal(field.raw, field.target) != nil {
						return bad("Invalid floor plan update")
					}
				}
				if updated.Apartments < 1 || updated.Apartments > 500 {
					return bad("Apartment count must be from 1 to 500")
				}
				if e := updated.validateFloorPlan(); e != nil {
					return e
				}
				images := map[string]string{}
				for key, url := range updated.PlanImages {
					rooms, exists := updated.planRooms(key)
					previousRooms, existed := s.Buildings[i].planRooms(key)
					if !exists || !existed || rooms != previousRooms {
						removed = append(removed, url)
					} else {
						images[key] = url
					}
				}
				updated.PlanImages = images
				s.Buildings[i] = updated
				return nil
			}
			return notFound()
		})
		if e == nil {
			for _, url := range removed {
				a.removePlanFile(u.BuildingID, url)
			}
			send(w, 200, updated)
		}
		return e
	})
	a.route(m, "GET /buildings/map", false, func(w http.ResponseWriter, r *http.Request, _ User) error {
		return a.Store.View(r.Context(), func(s *State) error {
			type mapBuilding struct {
				ID        int          `json:"id"`
				Name      string       `json:"name"`
				Address   string       `json:"address"`
				Floors    int          `json:"floors"`
				Lat       float64      `json:"lat"`
				Lon       float64      `json:"lon"`
				Footprint [][2]float64 `json:"footprint"`
			}
			out := []mapBuilding{}
			for _, b := range s.Buildings {
				ring := b.Footprint
				if ring == nil {
					ring = [][2]float64{}
				}
				out = append(out, mapBuilding{b.ID, b.Name, b.Address, b.Floors, b.Lat, b.Lon, ring})
			}
			send(w, 200, out)
			return nil
		})
	})
	a.route(m, "POST /buildings", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		// Decode point lengths explicitly: encoding/json pads/truncates fixed arrays.
		var input struct {
			Building
			Footprint [][]float64 `json:"footprint"`
		}
		if e := decode(r, &input); e != nil {
			return e
		}
		in := input.Building
		if len(in.PlanImages) != 0 {
			return bad("Upload floor plans after creating the building")
		}
		in.PlanImages = map[string]string{}
		for _, point := range input.Footprint {
			if len(point) != 2 {
				return bad("Each footprint point must contain longitude and latitude")
			}
			in.Footprint = append(in.Footprint, [2]float64{point[0], point[1]})
		}
		if in.OSMID < 0 || !validCoordinates(in.Lat, in.Lon) {
			return bad("Enter valid map coordinates and an OSM way id")
		}
		if (in.OSMID != 0 || len(in.Footprint) > 0) && !validFootprint(in.Footprint) {
			return bad("Choose a building with an open footprint of 3-200 distinct map points")
		}
		if strings.TrimSpace(in.Name) == "" || strings.TrimSpace(in.Address) == "" || len(in.Name) > 120 || len(in.Address) > 240 || in.Apartments < 1 || in.Apartments > 500 || in.Entrances < 1 || in.Entrances > 10 || in.Floors < 2 || in.Floors > 50 {
			return bad("Enter a name, address, 1-500 apartments, 1-10 entrances and 2-50 floors")
		}
		in.fillFloorPlan()
		if e := in.validateFloorPlan(); e != nil {
			return e
		}
		e := a.Store.Update(r.Context(), func(s *State) error {
			for _, b := range s.Buildings {
				if in.OSMID != 0 && b.OSMID == in.OSMID {
					return failure{409, "This building is already managed. Choose another building on the map"}
				}
			}
			in.ID = len(s.Buildings) + 1
			s.Buildings = append(s.Buildings, in)
			for i := range s.Users {
				if s.Users[i].ID == u.ID {
					s.Users[i].BuildingID = in.ID
				}
			}
			for n := 1; n <= in.Apartments; n++ {
				s.Invites = append(s.Invites, Invite{strings.ToUpper(ID()), in.ID, n, false})
			}
			return nil
		})
		if e == nil {
			if in.Footprint == nil {
				in.Footprint = [][2]float64{}
			}
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
