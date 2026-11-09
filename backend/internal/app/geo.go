package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const geoUserAgent = "Ortaq/1.0 (diploma project)"

var geoUnavailable = failure{503, "Map service busy or unavailable. Check your internet connection and try again"}

type geoPlace struct {
	Label string  `json:"label"`
	Lat   float64 `json:"lat"`
	Lon   float64 `json:"lon"`
}

type geoBuilding struct {
	OSMID          int64        `json:"osm_id"`
	Address        string       `json:"address"`
	Levels         int          `json:"levels"`
	Lat            float64      `json:"lat"`
	Lon            float64      `json:"lon"`
	Footprint      [][2]float64 `json:"footprint"`
	AlreadyManaged bool         `json:"already_managed,omitempty"`
}

type geoCacheEntry struct {
	value   any
	expires time.Time
}

type geoService struct {
	client              *http.Client
	nominatim, overpass string
	reverse             string // Nominatim reverse: fast outline lookup, Overpass is the fallback
	mu                  sync.Mutex
	cache               map[string]geoCacheEntry
	searchGate          chan struct{}
	nextSearch          time.Time // protected by searchGate
}

func (a *API) geoClient() *geoService {
	a.geoOnce.Do(func() {
		endpoint := func(env, fallback, suffix string) string {
			base := strings.TrimRight(os.Getenv(env), "/")
			if base == "" {
				base = fallback
			}
			if !strings.HasSuffix(base, suffix) {
				base += suffix
			}
			return base
		}
		a.geo = &geoService{
			client:    &http.Client{Timeout: geoHTTPTimeout},
			nominatim: endpoint("NOMINATIM_URL", "https://nominatim.openstreetmap.org", "/search"),
			overpass:  endpoint("OVERPASS_URL", "https://overpass-api.de/api", "/interpreter"),
			reverse:   endpoint("NOMINATIM_REVERSE_URL", strings.TrimSuffix(endpoint("NOMINATIM_URL", "https://nominatim.openstreetmap.org", "/search"), "/search"), "/reverse"),
			cache:     map[string]geoCacheEntry{}, searchGate: make(chan struct{}, 1),
		}
	})
	return a.geo
}

func (g *geoService) cached(key string) (any, bool) {
	g.mu.Lock()
	defer g.mu.Unlock()
	entry, ok := g.cache[key]
	return entry.value, ok && time.Now().Before(entry.expires)
}

func (g *geoService) remember(key string, value any) {
	g.mu.Lock()
	defer g.mu.Unlock()
	for key, entry := range g.cache {
		if time.Now().After(entry.expires) {
			delete(g.cache, key)
		}
	}
	if len(g.cache) >= 128 {
		for key := range g.cache {
			delete(g.cache, key)
			break
		}
	}
	g.cache[key] = geoCacheEntry{value, time.Now().Add(5 * time.Minute)}
}

func waitGeo(ctx context.Context, delay time.Duration) error {
	if delay <= 0 {
		return ctx.Err()
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// The request context bounds both attempts, backoff and rate-limit waits to 10 s.
func (g *geoService) fetch(ctx context.Context, endpoint, body string, search bool, out any) error {
	for attempt := 0; attempt < 2; attempt++ {
		if search {
			if waitGeo(ctx, time.Until(g.nextSearch)) != nil {
				return geoUnavailable
			}
			g.nextSearch = time.Now().Add(time.Second)
		}
		method := http.MethodGet
		if !search {
			method = http.MethodPost
		}
		req, err := http.NewRequestWithContext(ctx, method, endpoint, strings.NewReader(body))
		if err != nil {
			return geoUnavailable
		}
		req.Header.Set("User-Agent", geoUserAgent)
		req.Header.Set("Accept", "application/json")
		if !search {
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		}
		resp, err := g.client.Do(req)
		if err != nil {
			return geoUnavailable
		}
		if resp.StatusCode == 429 || resp.StatusCode == 502 || resp.StatusCode == 504 {
			resp.Body.Close()
			if attempt == 0 && waitGeo(ctx, time.Second) == nil {
				continue
			}
			return geoUnavailable
		}
		if resp.StatusCode != 200 {
			resp.Body.Close()
			return geoUnavailable
		}
		err = json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(out)
		resp.Body.Close()
		if err != nil {
			return geoUnavailable
		}
		return nil
	}
	return geoUnavailable
}

func (g *geoService) search(ctx context.Context, query string) ([]geoPlace, error) {
	key := "search:" + strings.ToLower(query)
	if value, ok := g.cached(key); ok {
		return value.([]geoPlace), nil
	}
	select {
	case g.searchGate <- struct{}{}:
		defer func() { <-g.searchGate }()
	case <-ctx.Done():
		return nil, geoUnavailable
	}
	// Coalesce identical searches that arrived while the upstream was in flight.
	if value, ok := g.cached(key); ok {
		return value.([]geoPlace), nil
	}
	params := url.Values{"q": {query}, "format": {"jsonv2"}, "addressdetails": {"1"},
		"countrycodes": {"kz"}, "limit": {"8"}, "viewbox": {"71.2,51.3,71.7,50.95"}, "bounded": {"0"}}
	var rows []struct {
		Label   string            `json:"display_name"`
		Lat     string            `json:"lat"`
		Lon     string            `json:"lon"`
		Address map[string]string `json:"address"`
	}
	if err := g.fetch(ctx, g.nominatim+"?"+params.Encode(), "", true, &rows); err != nil {
		return nil, err
	}
	// Prefer the Astana names supplied by OSM without excluding other KZ cities.
	sort.SliceStable(rows, func(i, j int) bool {
		astana := func(address map[string]string) bool {
			for _, key := range []string{"city", "town", "municipality", "state"} {
				switch strings.ToLower(address[key]) {
				case "astana", "астана", "nur-sultan", "нур-султан":
					return true
				}
			}
			return false
		}
		return astana(rows[i].Address) && !astana(rows[j].Address)
	})
	out := []geoPlace{}
	for _, row := range rows {
		lat, e1 := strconv.ParseFloat(row.Lat, 64)
		lon, e2 := strconv.ParseFloat(row.Lon, 64)
		if e1 != nil || e2 != nil || !validCoordinates(lat, lon) || strings.ToLower(row.Address["country_code"]) != "kz" || strings.TrimSpace(row.Label) == "" {
			continue
		}
		out = append(out, geoPlace{row.Label, lat, lon})
		if len(out) == 8 {
			break
		}
	}
	g.remember(key, out)
	return out, nil
}

func osmAddress(tags map[string]string) string {
	street := strings.TrimSpace(tags["addr:street"])
	number := strings.TrimSpace(tags["addr:housenumber"])
	address := strings.TrimSpace(street + " " + number)
	if address == "" {
		return "" // Do not invent an address for an unaddressed OSM building.
	}
	city := strings.TrimSpace(tags["addr:city"])
	if city == "" {
		city = "Astana"
	}
	return address + ", " + city
}

func validCoordinates(lat, lon float64) bool {
	return !math.IsNaN(lat) && !math.IsNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

func validFootprint(ring [][2]float64) bool {
	if len(ring) < 3 || len(ring) > 200 {
		return false
	}
	seen := map[[2]float64]bool{}
	var area float64
	for i, point := range ring {
		if !validCoordinates(point[1], point[0]) || seen[point] {
			return false
		}
		seen[point] = true
		next := ring[(i+1)%len(ring)]
		// Translate before computing area to avoid cancellation at city coordinates.
		area += (point[0]-ring[0][0])*(next[1]-ring[0][1]) - (next[0]-ring[0][0])*(point[1]-ring[0][1])
	}
	return math.Abs(area) > 1e-14
}

// Distance to the outline in metres, or zero when the point is inside it.
func footprintDistance(ring [][2]float64, lat, lon float64) float64 {
	inside, distance := false, math.Inf(1)
	xScale := 6371000 * math.Pi / 180 * math.Cos(lat*math.Pi/180)
	yScale := 6371000 * math.Pi / 180
	for i, point := range ring {
		next := ring[(i+1)%len(ring)]
		if (point[1] > lat) != (next[1] > lat) && lon < (next[0]-point[0])*(lat-point[1])/(next[1]-point[1])+point[0] {
			inside = !inside
		}
		x, y := (point[0]-lon)*xScale, (point[1]-lat)*yScale
		dx, dy := (next[0]-point[0])*xScale, (next[1]-point[1])*yScale
		t := 0.0
		if length := dx*dx + dy*dy; length > 0 {
			t = math.Max(0, math.Min(1, -(x*dx+y*dy)/length))
		}
		distance = math.Min(distance, math.Hypot(x+t*dx, y+t*dy))
	}
	if inside {
		return 0
	}
	return distance
}

func footprintCentre(ring [][2]float64) (lat, lon float64) {
	var area, x, y float64
	origin := ring[0]
	for i, point := range ring {
		next := ring[(i+1)%len(ring)]
		px, py := point[0]-origin[0], point[1]-origin[1]
		nx, ny := next[0]-origin[0], next[1]-origin[1]
		cross := px*ny - nx*py
		area += cross
		x += (px + nx) * cross
		y += (py + ny) * cross
	}
	return origin[1] + y/(3*area), origin[0] + x/(3*area)
}

func (g *geoService) lookup(ctx context.Context, lat, lon float64) (geoBuilding, error) {
	key := fmt.Sprintf("building:%.8f,%.8f", lat, lon)
	if value, ok := g.cached(key); ok {
		return value.(geoBuilding), nil
	}
	if best, ok := g.reverseLookup(ctx, lat, lon); ok {
		g.remember(key, best)
		return best, nil
	}
	// is_in includes containing closed ways even when their edges are far away.
	query := fmt.Sprintf(`[out:json][timeout:25];is_in(%.8f,%.8f)->.containing;(way(pivot.containing)["building"]["building"!="no"];way["building"]["building"!="no"](around:40,%.8f,%.8f););out body geom;`, lat, lon, lat, lon)
	var data struct {
		Remark   string `json:"remark"`
		Elements []struct {
			Type     string            `json:"type"`
			ID       int64             `json:"id"`
			Tags     map[string]string `json:"tags"`
			Geometry []struct {
				Lat float64 `json:"lat"`
				Lon float64 `json:"lon"`
			} `json:"geometry"`
		} `json:"elements"`
	}
	if err := g.fetch(ctx, g.overpass, url.Values{"data": {query}}.Encode(), false, &data); err != nil {
		return geoBuilding{}, err
	}
	if data.Remark != "" {
		return geoBuilding{}, geoUnavailable
	}
	best, bestDistance := geoBuilding{}, math.Inf(1)
	for _, way := range data.Elements {
		if way.Type != "way" || way.ID <= 0 || way.Tags["building"] == "" || way.Tags["building"] == "no" {
			continue
		}
		ring := make([][2]float64, 0, len(way.Geometry))
		for _, point := range way.Geometry {
			ring = append(ring, [2]float64{point.Lon, point.Lat})
		}
		if len(ring) < 4 || ring[0] != ring[len(ring)-1] {
			continue // OSM building ways must be closed; the JSON contract is open.
		}
		ring = ring[:len(ring)-1]
		if !validFootprint(ring) {
			continue
		}
		distance := footprintDistance(ring, lat, lon)
		if distance > 40 || distance >= bestDistance {
			continue
		}
		levels, err := strconv.Atoi(way.Tags["building:levels"])
		if err != nil || levels < 0 {
			levels = 0
		}
		centreLat, centreLon := footprintCentre(ring)
		best = geoBuilding{OSMID: way.ID, Address: osmAddress(way.Tags), Levels: levels, Lat: centreLat, Lon: centreLon, Footprint: ring}
		bestDistance = distance
	}
	if best.OSMID == 0 {
		return best, failure{404, "No mapped building found within 40 m. Click a building outline or try another address"}
	}
	g.remember(key, best)
	return best, nil
}

// reverseLookup asks Nominatim for the building at the point. It answers in about
// a second while the public Overpass server can take 20-40 s under load.
func (g *geoService) reverseLookup(ctx context.Context, lat, lon float64) (geoBuilding, bool) {
	params := url.Values{"lat": {strconv.FormatFloat(lat, 'f', 8, 64)}, "lon": {strconv.FormatFloat(lon, 'f', 8, 64)},
		"format": {"jsonv2"}, "zoom": {"18"}, "layer": {"address"}, "polygon_geojson": {"1"}, "extratags": {"1"}, "addressdetails": {"1"}}
	var row struct {
		OSMType   string            `json:"osm_type"`
		OSMID     int64             `json:"osm_id"`
		Category  string            `json:"category"`
		Type      string            `json:"type"`
		Address   map[string]string `json:"address"`
		ExtraTags map[string]string `json:"extratags"`
		GeoJSON   struct {
			Type        string         `json:"type"`
			Coordinates [][][2]float64 `json:"coordinates"`
		} `json:"geojson"`
	}
	if g.fetch(ctx, g.reverse+"?"+params.Encode(), "", true, &row) != nil || row.OSMType != "way" || row.OSMID <= 0 ||
		row.Category != "building" || row.Type == "no" || row.GeoJSON.Type != "Polygon" || len(row.GeoJSON.Coordinates) == 0 {
		return geoBuilding{}, false
	}
	ring := row.GeoJSON.Coordinates[0]
	if len(ring) < 4 || ring[0] != ring[len(ring)-1] {
		return geoBuilding{}, false
	}
	ring = ring[:len(ring)-1]
	if !validFootprint(ring) || footprintDistance(ring, lat, lon) > 40 {
		return geoBuilding{}, false
	}
	levels, err := strconv.Atoi(row.ExtraTags["building:levels"])
	if err != nil || levels < 0 {
		levels = 0
	}
	city := row.Address["city"]
	if city == "" {
		city = row.Address["town"]
	}
	address := osmAddress(map[string]string{"addr:street": row.Address["road"], "addr:housenumber": row.Address["house_number"], "addr:city": city})
	centreLat, centreLon := footprintCentre(ring)
	return geoBuilding{OSMID: row.OSMID, Address: address, Levels: levels, Lat: centreLat, Lon: centreLon, Footprint: ring}, true
}

func (a *API) geoRoutes(m *http.ServeMux) {
	a.route(m, "GET /geo/search", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		query := strings.TrimSpace(r.URL.Query().Get("q"))
		if len(query) < 2 || len(query) > 240 {
			return bad("Enter an address between 2 and 240 characters")
		}
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		places, err := a.geoClient().search(ctx, query)
		if err == nil {
			send(w, 200, places)
		}
		return err
	})
	a.route(m, "GET /geo/building", true, func(w http.ResponseWriter, r *http.Request, u User) error {
		if u.Role != "chairman" {
			return forbidden()
		}
		lat, e1 := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
		lon, e2 := strconv.ParseFloat(r.URL.Query().Get("lon"), 64)
		if e1 != nil || e2 != nil || !validCoordinates(lat, lon) {
			return bad("Choose a valid point on the map")
		}
		ctx, cancel := context.WithTimeout(r.Context(), geoHTTPTimeout)
		defer cancel()
		building, err := a.geoClient().lookup(ctx, lat, lon)
		if err != nil {
			return err
		}
		return a.Store.View(ctx, func(s *State) error {
			for _, managed := range s.Buildings {
				if managed.OSMID == building.OSMID {
					building.AlreadyManaged = true
					break
				}
			}
			send(w, 200, building)
			return nil
		})
	})
}

// The public Overpass server often needs 20-40 s under load; stay below the
// management app's 30 s request timeout.
const geoHTTPTimeout = 28 * time.Second
