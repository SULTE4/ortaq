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
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Address    string `json:"address"`
	Entrances  int    `json:"entrances"`
	Floors     int    `json:"floors"`
	Apartments int    `json:"apartments"`
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
		Polls:         seedPolls(now),
		Announcements: seedAnnouncements(now),
		Issues:        seedIssues(now),
		Reports:       seedReports(now),
		Buildings:     []Building{{1, "ЖК Ortaq Demo", "Kabanbay Batyr Ave 60, Astana", 3, 9, 120}},
		Users:         []User{{1, "+77000000001", "Aigerim S.", "chairman", 1, 0}, {2, "+77000000002", "Daniyar K.", "accountant", 1, 0}, {3, "+77000000011", "Amina T.", "resident", 1, 12}, {4, "+77000000012", "Arman B.", "resident", 1, 45}, {5, "+77000000013", "Dana M.", "resident", 1, 87}},
		Invites:       seedInvites(), Challenges: map[string]Challenge{},
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
