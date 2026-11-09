package app

import "time"

type User struct {
	ID         int    `json:"id"`
	Phone      string `json:"phone"`
	Name       string `json:"name"`
	Role       string `json:"role"`
	BuildingID int    `json:"building_id"`
	Apartment  int    `json:"apartment"`
}
type Building struct {
	ID            int               `json:"id"`
	Name          string            `json:"name"`
	Address       string            `json:"address"`
	Entrances     int               `json:"entrances"`
	Floors        int               `json:"floors"`
	Apartments    int               `json:"apartments"`
	FloorPlan     []int             `json:"floor_plan"`
	EntrancePlans map[string][]int  `json:"entrance_plans,omitempty"`
	PlanImages    map[string]string `json:"plan_images"`
	OSMID         int64             `json:"osm_id"`
	Lat           float64           `json:"lat"`
	Lon           float64           `json:"lon"`
	Footprint     [][2]float64      `json:"footprint"`
}
type Invite struct {
	Code       string `json:"code"`
	BuildingID int    `json:"building_id"`
	Apartment  int    `json:"apartment"`
	Revoked    bool   `json:"revoked"`
}
type Challenge struct {
	Expires  time.Time `json:"expires"`
	Attempts int       `json:"attempts"`
}
type State struct {
	Feedback      []Feedback           `json:"feedback"`
	Balances      []Balance            `json:"balances"`
	Polls         []Poll               `json:"polls"`
	Announcements []Announcement       `json:"announcements"`
	Notifications []Notification       `json:"notifications"`
	Issues        []Issue              `json:"issues"`
	Reports       []Report             `json:"reports"`
	Users         []User               `json:"users"`
	Buildings     []Building           `json:"buildings"`
	Invites       []Invite             `json:"invites"`
	Challenges    map[string]Challenge `json:"challenges"`
}

func Seed(now time.Time) *State {
	return &State{
		Balances:      seedBalances(now),
		Polls:         seedPolls(now),
		Announcements: seedAnnouncements(now),
		Issues:        seedIssues(now),
		Reports:       seedReports(now),
		Buildings:     []Building{seedBuilding()},
		Users:         []User{{1, "+77000000001", "Aigerim S.", "chairman", 1, 0}, {2, "+77000000002", "Daniyar K.", "accountant", 1, 0}, {3, "+77000000011", "Amina T.", "resident", 1, 12}, {4, "+77000000012", "Arman B.", "resident", 1, 45}, {5, "+77000000013", "Dana M.", "resident", 1, 87}},
		Invites:       seedInvites(), Challenges: map[string]Challenge{},
	}
}

func seedBuilding() Building {
	return Building{
		ID: 1, Name: "ЖК Ortaq Demo", Address: "6 Sauran St, Astana",
		Entrances: 3, Floors: 9, Apartments: 120, FloorPlan: []int{3, 1, 2, 1, 3}, PlanImages: map[string]string{},
		EntrancePlans: map[string][]int{"3": {3, 2, 2, 2, 3}},
		OSMID:         425124327, Lat: 51.122618, Lon: 71.423048,
		Footprint: [][2]float64{{71.4225657, 51.1225401}, {71.422685, 51.122859}, {71.422867, 51.1228321}, {71.4227873, 51.1226193}, {71.4237113, 51.1224831}, {71.4236716, 51.122377}},
	}
}

// Restore missing typical floors and the known demo geometry on legacy loads.
func (s *State) restoreBuildingGeometry() {
	for i := range s.Buildings {
		b := &s.Buildings[i]
		b.fillFloorPlan()
		if b.PlanImages == nil {
			b.PlanImages = map[string]string{}
		}
		if b.ID == 1 && len(b.Footprint) == 0 {
			seed := seedBuilding()
			b.OSMID, b.Lat, b.Lon, b.Footprint = seed.OSMID, seed.Lat, seed.Lon, seed.Footprint
		}
	}
}

// Old records keep their counts and any explicitly stored plan.
func (b *Building) fillFloorPlan() {
	if b.FloorPlan != nil || b.Entrances < 1 || b.Floors < 2 {
		return
	}
	floors := b.Entrances * (b.Floors - 1)
	if b.Apartments < floors || b.Apartments%floors != 0 {
		return // No repeating plan can represent inconsistent legacy counts.
	}
	n := b.Apartments / floors
	if n == 5 {
		b.FloorPlan = []int{3, 1, 2, 1, 3}
	} else {
		b.FloorPlan = make([]int, n)
		for i := range b.FloorPlan {
			b.FloorPlan[i] = 2
		}
	}
}
func (s *State) building(id int) Building {
	for _, b := range s.Buildings {
		if b.ID == id {
			return b
		}
	}
	return Building{}
}
func (s *State) user(id int) User {
	for _, u := range s.Users {
		if u.ID == id {
			return u
		}
	}
	return User{}
}
