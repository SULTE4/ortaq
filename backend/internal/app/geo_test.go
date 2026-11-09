package app

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func geoCall(t *testing.T, a *API, path string, user int) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest("GET", path, nil)
	if user != 0 {
		r.Header.Set("Authorization", "Bearer "+a.token(User{ID: user}))
	}
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, r)
	return w
}

func fakeGeo(t *testing.T, handler http.HandlerFunc) *API {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	t.Setenv("NOMINATIM_URL", server.URL)
	t.Setenv("OVERPASS_URL", server.URL)
	// Nominatim's real "nothing here" answer, so these tests exercise the Overpass path.
	none := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, `{"error":"Unable to geocode"}`) }))
	t.Cleanup(none.Close)
	t.Setenv("NOMINATIM_REVERSE_URL", none.URL)
	return testAPI(t)
}

func TestGeoBuildingFromNominatimReverse(t *testing.T) {
	a := fakeGeo(t, func(w http.ResponseWriter, r *http.Request) { t.Fatal("Overpass should not be called", r.URL.Path) })
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if r.URL.Path != "/reverse" || q.Get("polygon_geojson") != "1" || q.Get("extratags") != "1" || r.Header.Get("User-Agent") != geoUserAgent {
			t.Fatal("unexpected reverse request", r.URL.String())
		}
		fmt.Fprint(w, `{"osm_type":"way","osm_id":425124327,"category":"building","type":"apartments","address":{"road":"Сауран көшесі","house_number":"6","city":"Астана"},"extratags":{"building:levels":"9"},"geojson":{"type":"Polygon","coordinates":[[[71.4225657,51.1225401],[71.422685,51.122859],[71.422867,51.1228321],[71.4227873,51.1226193],[71.4237113,51.1224831],[71.4236716,51.122377],[71.4225657,51.1225401]]]}}`)
	}))
	t.Cleanup(server.Close)
	t.Setenv("NOMINATIM_REVERSE_URL", server.URL)
	w := geoCall(t, a, "/geo/building?lat=51.1226&lon=71.4230", 1)
	var got geoBuilding
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &got) != nil || got.OSMID != 425124327 || got.Levels != 9 || got.Address != "Сауран көшесі 6, Астана" || len(got.Footprint) != 6 {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestGeoSearchParsingAndCache(t *testing.T) {
	var calls atomic.Int32
	a := fakeGeo(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		q := r.URL.Query()
		if r.URL.Path != "/search" || r.Header.Get("User-Agent") != geoUserAgent || q.Get("q") != "Sauran 6" || q.Get("countrycodes") != "kz" || q.Get("addressdetails") != "1" || q.Get("limit") != "8" || q.Get("viewbox") == "" || q.Get("bounded") != "0" {
			t.Error("invalid upstream search", r.URL, r.Header)
		}
		fmt.Fprint(w, `[
		 {"display_name":"Almaty","lat":"43.25","lon":"76.95","address":{"city":"Almaty","country_code":"kz"}},
		 {"display_name":"Sauran 6, Astana","lat":"51.122618","lon":"71.423048","address":{"city":"Астана","country_code":"kz"}},
		 {"display_name":"Elsewhere","lat":"51","lon":"71","address":{"country_code":"ru"}},
		 {"display_name":"Bad latitude","lat":"NaN","lon":"71","address":{"country_code":"kz"}},
		 {"display_name":"Bad longitude","lat":"51","lon":"oops","address":{"country_code":"kz"}}
		]`)
	})
	for i := 0; i < 2; i++ {
		w := geoCall(t, a, "/api/v1/geo/search?q=Sauran%206", 1)
		var rows []geoPlace
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &rows) != nil || len(rows) != 2 || rows[0].Label != "Sauran 6, Astana" || rows[0].Lat != 51.122618 || rows[0].Lon != 71.423048 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	if calls.Load() != 1 {
		t.Fatal("identical search was not cached", calls.Load())
	}
}

func TestGeoSearchLimitAndEmpty(t *testing.T) {
	a := fakeGeo(t, func(w http.ResponseWriter, r *http.Request) {
		rows := []map[string]any{}
		if r.URL.Query().Get("q") != "missing" {
			for i := 0; i < 12; i++ {
				rows = append(rows, map[string]any{"display_name": fmt.Sprint(i), "lat": "51", "lon": "71", "address": map[string]string{"country_code": "kz"}})
			}
		}
		json.NewEncoder(w).Encode(rows)
	})
	w := geoCall(t, a, "/v1/geo/search?q=homes", 1)
	var rows []geoPlace
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &rows) != nil || len(rows) != 8 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = geoCall(t, a, "/geo/search?q=missing", 1)
	if w.Code != 200 || strings.TrimSpace(w.Body.String()) != "[]" {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestGeoAuthorizationAndInput(t *testing.T) {
	a := fakeGeo(t, func(w http.ResponseWriter, r *http.Request) { t.Error("upstream should not be called") })
	for _, path := range []string{"/api/v1/geo/search?q=Astana", "/api/v1/geo/building?lat=51&lon=71"} {
		for user, expected := range map[int]int{0: 401, 2: 403, 3: 403} {
			if w := geoCall(t, a, path, user); w.Code != expected {
				t.Fatal(path, user, w.Code)
			}
		}
	}
	for _, path := range []string{"/geo/search", "/geo/search?q=a", "/geo/building", "/geo/building?lat=NaN&lon=71", "/geo/building?lat=51&lon=181", "/geo/building?lat=91&lon=71", "/geo/building?lat=Inf&lon=71"} {
		if w := geoCall(t, a, path, 1); w.Code != 400 {
			t.Fatal(path, w.Code, w.Body.String())
		}
	}
}

const geoWays = `{"elements":[
 {"type":"way","id":42,"tags":{"building":"apartments","building:levels":"9","addr:street":"Sauran St","addr:housenumber":"6"},"geometry":[{"lat":51,"lon":71},{"lat":51,"lon":71.001},{"lat":51.001,"lon":71.001},{"lat":51.001,"lon":71},{"lat":51,"lon":71}]},
 {"type":"way","id":43,"tags":{"building":"yes","addr:street":"Other St","addr:housenumber":"12","addr:city":"Karaganda"},"geometry":[{"lat":51,"lon":71.002},{"lat":51,"lon":71.003},{"lat":51.001,"lon":71.003},{"lat":51.001,"lon":71.002},{"lat":51,"lon":71.002}]}
]}`

func TestGeoBuildingLookup(t *testing.T) {
	for _, tc := range []struct {
		name, point string
		id          int64
		status      int
	}{
		{"inside", "lat=51.0005&lon=71.0005", 42, 200},
		{"edge", "lat=51&lon=71.0005", 42, 200},
		{"nearest boundary within 40m", "lat=51.0013&lon=71.0005", 42, 200},
		{"inside takes priority", "lat=51.0005&lon=71.0021", 43, 200},
		{"nearest second building", "lat=51.0005&lon=71.0016", 43, 200},
		{"outside 40m", "lat=51.0014&lon=71.0005", 0, 404},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a := fakeGeo(t, func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/interpreter" || r.Method != "POST" || r.Header.Get("User-Agent") != geoUserAgent {
					t.Error("invalid upstream building request", r.Method, r.URL, r.Header)
				}
				r.ParseForm()
				if !strings.Contains(r.Form.Get("data"), "out body geom") || !strings.Contains(r.Form.Get("data"), `["building"]`) || !strings.Contains(r.Form.Get("data"), "is_in(") || !strings.Contains(r.Form.Get("data"), "around:40,") {
					t.Error("missing geometry query", r.Form)
				}
				fmt.Fprint(w, geoWays)
			})
			w := geoCall(t, a, "/api/v1/geo/building?"+tc.point, 1)
			if w.Code != tc.status {
				t.Fatal(w.Code, w.Body.String())
			}
			if tc.status == 404 {
				if !strings.Contains(w.Body.String(), "40 m") {
					t.Fatal("missing friendly error", w.Body.String())
				}
				return
			}
			var building geoBuilding
			if json.Unmarshal(w.Body.Bytes(), &building) != nil || building.OSMID != tc.id || len(building.Footprint) != 4 || building.Footprint[0] == building.Footprint[3] {
				t.Fatal(w.Body.String())
			}
			if math.Abs(building.Lat-51.0005) > 1e-9 || building.Footprint[0][0] != 71+float64(tc.id-42)*.002 {
				t.Fatal("centre or lon/lat order", building)
			}
			if tc.id == 42 && (building.Address != "Sauran St 6, Astana" || building.Levels != 9) {
				t.Fatal(building)
			}
			if tc.id == 43 && (building.Address != "Other St 12, Karaganda" || building.Levels != 0) {
				t.Fatal(building)
			}
		})
	}
}

func TestGeoBuildingCacheRefreshesManagedFlag(t *testing.T) {
	var calls atomic.Int32
	a := fakeGeo(t, func(w http.ResponseWriter, r *http.Request) { calls.Add(1); fmt.Fprint(w, geoWays) })
	path := "/geo/building?lat=51.0005&lon=71.0005"
	w := geoCall(t, a, path, 1)
	if w.Code != 200 || strings.Contains(w.Body.String(), "already_managed") {
		t.Fatal(w.Code, w.Body.String())
	}
	a.Store.Update(context.Background(), func(s *State) error {
		s.Buildings = append(s.Buildings, Building{ID: 2, OSMID: 42})
		return nil
	})
	w = geoCall(t, a, path, 1)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"already_managed":true`) || calls.Load() != 1 {
		t.Fatal(w.Code, w.Body.String(), calls.Load())
	}
}

func TestOSMAddress(t *testing.T) {
	for _, tc := range []struct {
		tags map[string]string
		want string
	}{
		{map[string]string{"addr:street": " Сауран көшесі ", "addr:housenumber": " 6 "}, "Сауран көшесі 6, Astana"},
		{map[string]string{"addr:street": "Abay", "addr:housenumber": "10", "addr:city": "Almaty"}, "Abay 10, Almaty"},
		{map[string]string{}, ""},
	} {
		if got := osmAddress(tc.tags); got != tc.want {
			t.Fatal(got, tc.want)
		}
	}
}

func TestGeoRetryOnceAndBusyError(t *testing.T) {
	for _, search := range []bool{false, true} {
		for _, status := range []int{429, 502, 504} {
			t.Run(fmt.Sprintf("search=%v/status=%d", search, status), func(t *testing.T) {
				var calls atomic.Int32
				a := fakeGeo(t, func(w http.ResponseWriter, r *http.Request) {
					calls.Add(1)
					w.WriteHeader(status)
				})
				path := "/geo/building?lat=51&lon=71"
				if search {
					path = "/geo/search?q=Astana"
				}
				w := geoCall(t, a, path, 1)
				if w.Code != 503 || calls.Load() != 2 || !strings.Contains(w.Body.String(), "internet") {
					t.Fatal(w.Code, w.Body.String(), calls.Load())
				}
			})
		}
	}
	var calls atomic.Int32
	a := fakeGeo(t, func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			w.WriteHeader(502)
			return
		}
		fmt.Fprint(w, geoWays)
	})
	if w := geoCall(t, a, "/geo/building?lat=51.0005&lon=71.0005", 1); w.Code != 200 || calls.Load() != 2 {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestGeoNominatimRateLimit(t *testing.T) {
	starts := make(chan time.Time, 3)
	var calls atomic.Int32
	a := fakeGeo(t, func(w http.ResponseWriter, r *http.Request) {
		starts <- time.Now()
		if calls.Add(1) == 1 {
			w.WriteHeader(429)
			return
		}
		fmt.Fprint(w, `[]`)
	})
	for _, query := range []string{"first", "second"} {
		if w := geoCall(t, a, "/geo/search?q="+query, 1); w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	previous := <-starts
	for i := 0; i < 2; i++ {
		next := <-starts
		if next.Sub(previous) < 990*time.Millisecond {
			t.Fatal("requests started less than one second apart", next.Sub(previous))
		}
		previous = next
	}
}

func TestGeoCancellationAndMalformedUpstream(t *testing.T) {
	a := fakeGeo(t, func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, `<html>offline</html>`) })
	if w := geoCall(t, a, "/geo/search?q=Astana", 1); w.Code != 503 {
		t.Fatal(w.Code, w.Body.String())
	}
	if a.geoClient().client.Timeout != geoHTTPTimeout {
		t.Fatal("missing HTTP timeout")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := a.geoClient().lookup(ctx, 51, 71); err == nil {
		t.Fatal("cancelled request succeeded")
	}
	g := a.geoClient()
	for i := 0; i < 140; i++ {
		g.remember(fmt.Sprint(i), i)
	}
	if len(g.cache) > 128 {
		t.Fatal("cache grew without bound")
	}
	g.cache["expired"] = geoCacheEntry{value: 1, expires: time.Now().Add(-time.Second)}
	if _, ok := g.cached("expired"); ok {
		t.Fatal("expired cache entry reused")
	}
}

func TestGeoEmptyBuildingResult(t *testing.T) {
	a := fakeGeo(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"elements":[]}`)
	})
	w := geoCall(t, a, "/geo/building?lat=51&lon=71", 1)
	if w.Code != 404 || !strings.Contains(w.Body.String(), "Click a building") {
		t.Fatal(w.Code, w.Body.String())
	}
}
