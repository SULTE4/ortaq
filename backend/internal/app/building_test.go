package app

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestInvites(t *testing.T) {
	a := testAPI(t)
	if c, _ := call(t, a, "GET", "/invites", "", 3); c != 403 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/buildings", `{"name":"New home","address":"Astana","entrances":1,"floors":5,"apartments":12,"floor_plan":[2,1,3]}`, 3); c != 403 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/invites/ORTAQ-045/revoke", `{}`, 1); c != 200 {
		t.Fatal(c)
	}
	call(t, a, "POST", "/auth/otp", `{"phone":"+77000000099"}`, 0)
	if c, _ := call(t, a, "POST", "/auth/verify", `{"phone":"+77000000099","code":"1234","invite":"ORTAQ-045"}`, 0); c != 400 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/invites", `{"apartment":121}`, 1); c != 400 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/buildings", `{"name":"New home","address":"Astana","entrances":1,"floors":5,"apartments":12,"floor_plan":[2,1,3]}`, 1); c != 201 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/invites/ORTAQ-012/revoke", `{}`, 1); c != 404 {
		t.Fatal("cross building invite", c)
	}
}

func TestRegisterInNewBuilding(t *testing.T) {
	a := testAPI(t)
	c, v := call(t, a, "POST", "/buildings", `{"name":"New home","address":"Astana","entrances":1,"floors":5,"apartments":12,"floor_plan":[2,1,3]}`, 1)
	if c != 201 {
		t.Fatal(c, v)
	}
	var code string
	a.Store.View(context.Background(), func(s *State) error {
		for _, invite := range s.Invites {
			if invite.BuildingID == 2 && invite.Apartment == 1 {
				code = invite.Code
			}
		}
		return nil
	})
	if code == "" {
		t.Fatal("new apartment has no invitation")
	}
	call(t, a, "POST", "/auth/otp", `{"phone":"+77000000099"}`, 0)
	body, _ := json.Marshal(map[string]string{"phone": "+77000000099", "code": "1234", "invite": strings.ToLower(code)})
	c, v = call(t, a, "POST", "/auth/verify", string(body), 0)
	if c != 200 {
		t.Fatal(c, v)
	}
	user := v["user"].(map[string]any)
	if user["building_id"] != float64(2) || user["apartment"] != float64(1) {
		t.Fatal(user)
	}
}

func TestMappedBuildingCreationAndDuplicate(t *testing.T) {
	a := testAPI(t)
	b := Building{ID: 99, Name: "Second home", Address: "Real street 12, Astana", Entrances: 2, Floors: 5, Apartments: 32, FloorPlan: []int{3, 1, 2, 1},
		OSMID: 12345, Lat: 51.15, Lon: 71.45,
		Footprint: [][2]float64{{71.449, 51.149}, {71.451, 51.149}, {71.451, 51.151}, {71.449, 51.151}}}
	body, _ := json.Marshal(b)
	code, value := call(t, a, "POST", "/api/v1/buildings", string(body), 1)
	if code != 201 || value["id"] != float64(2) || value["osm_id"] != float64(12345) || value["lat"] != b.Lat || value["lon"] != b.Lon || len(value["footprint"].([]any)) != 4 {
		t.Fatal(code, value)
	}
	for _, path := range []string{"/api/v1/building", "/api/v1/scene"} {
		code, got := call(t, a, "GET", path, "", 1)
		if path == "/api/v1/scene" {
			got = got["building"].(map[string]any)
		}
		if code != 200 || got["osm_id"] != float64(12345) || got["floors"] != float64(5) {
			t.Fatal(path, code, got)
		}
	}
	if code, value = call(t, a, "POST", "/v1/buildings", string(body), 1); code != 409 || !strings.Contains(value["error"].(string), "already managed") {
		t.Fatal(code, value)
	}
	seed := seedBuilding()
	body, _ = json.Marshal(seed)
	if code, _ = call(t, a, "POST", "/buildings", string(body), 1); code != 409 {
		t.Fatal("seed OSM duplicate accepted", code)
	}
	a.Store.View(context.Background(), func(s *State) error {
		if len(s.Buildings) != 2 || s.user(1).BuildingID != 2 || len(s.Invites) != 152 {
			t.Fatal("duplicate mutated state", len(s.Buildings), s.user(1), len(s.Invites))
		}
		return nil
	})
}

func TestMappedBuildingValidation(t *testing.T) {
	a := testAPI(t)
	base := map[string]any{"name": "Mapped home", "address": "Astana", "floors": 9, "entrances": 1, "apartments": 40, "floor_plan": []int{3, 1, 2, 1, 3}, "osm_id": 12345, "lat": 51.0, "lon": 71.0}
	for _, ring := range []any{
		nil,
		[][]float64{{71, 51}, {71.1, 51}},
		[][]float64{{71, 51}, {71.1, 51}, {71.1, 51.1}, {71, 51}},
		[][]float64{{181, 51}, {71.1, 51}, {71.1, 51.1}},
		[][]float64{{71}, {71.1, 51}, {71.1, 51.1}},
		[][]float64{{71, 51, 1}, {71.1, 51}, {71.1, 51.1}},
		[][]float64{{71, 51}, {71.1, 51.1}, {71.2, 51.2}},
		make([][2]float64, 201),
	} {
		base["footprint"] = ring
		body, _ := json.Marshal(base)
		if code, value := call(t, a, "POST", "/api/v1/buildings", string(body), 1); code != 400 {
			t.Fatal("invalid ring accepted", string(body), code, value)
		}
	}
	base["footprint"] = [][2]float64{{71, 51}, {71.1, 51}, {71.1, 51.1}}
	for _, tc := range []struct {
		key   string
		value any
	}{{"lat", 91}, {"lon", -181}, {"osm_id", -1}} {
		original := base[tc.key]
		base[tc.key] = tc.value
		body, _ := json.Marshal(base)
		if code, value := call(t, a, "POST", "/buildings", string(body), 1); code != 400 {
			t.Fatal(tc, code, value)
		}
		base[tc.key] = original
	}
}

func TestPublicBuildingsMapProjection(t *testing.T) {
	a := testAPI(t)
	a.Store.Update(context.Background(), func(s *State) error {
		s.Buildings = append(s.Buildings, Building{ID: 2, Name: "Legacy home", Address: "Astana", Floors: 4})
		return nil
	})
	w := geoCall(t, a, "/api/v1/buildings/map", 0)
	var buildings []map[string]any
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &buildings) != nil || len(buildings) != 2 {
		t.Fatal(w.Code, w.Body.String())
	}
	allowed := map[string]bool{"id": true, "name": true, "address": true, "floors": true, "lat": true, "lon": true, "footprint": true}
	for _, b := range buildings {
		if len(b) != len(allowed) {
			t.Fatal("unexpected map fields", b)
		}
		for key := range b {
			if !allowed[key] {
				t.Fatal("private or unexpected field", key)
			}
		}
	}
	if len(buildings[0]["footprint"].([]any)) != 6 || buildings[0]["lat"] != 51.122618 || len(buildings[1]["footprint"].([]any)) != 0 {
		t.Fatal(buildings)
	}
}

func TestLegacyStateRestoresOnlyDemoGeometry(t *testing.T) {
	a := testAPI(t)
	s := Seed(a.Now())
	s.Buildings[0].OSMID, s.Buildings[0].Lat, s.Buildings[0].Lon, s.Buildings[0].Footprint = 0, 0, 0, nil
	s.Buildings[0].Name = "Existing custom name"
	s.Buildings = append(s.Buildings, Building{ID: 2, Name: "Other legacy building"})
	a.Store = NewMemory(s)
	for _, path := range []string{"/api/v1/building", "/api/v1/scene"} {
		code, b := call(t, a, "GET", path, "", 1)
		if path == "/api/v1/scene" {
			b = b["building"].(map[string]any)
		}
		if code != 200 || b["osm_id"] != float64(425124327) || b["lat"] != 51.122618 || b["lon"] != 71.423048 || b["name"] != "Existing custom name" || len(b["footprint"].([]any)) != 6 {
			t.Fatal(path, code, b)
		}
	}
	a.Store.Update(context.Background(), func(state *State) error {
		if len(state.Users) != len(s.Users) || len(state.Issues) != len(s.Issues) || len(state.Invites) != 120 || state.Buildings[1].OSMID != 0 || len(state.Buildings[1].Footprint) != 0 {
			t.Fatal("legacy state changed beyond demo geometry")
		}
		return nil
	})
	var persisted State
	json.Unmarshal(a.Store.(*Memory).data, &persisted)
	if persisted.Buildings[0].OSMID != seedBuilding().OSMID {
		t.Fatal("geometry not persisted on next update")
	}
}
