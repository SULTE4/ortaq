package app

import "testing"

const newIssue = `{"title":"Cold radiator","description":"Shared corridor radiator is cold","category":"Heating","location":{"entrance":2,"floor":2,"area":""},"photo":"/media/seed/issue.png"}`

func TestReportIssue(t *testing.T) {
	a := testAPI(t)
	c, v := call(t, a, "POST", "/issues", newIssue, 4)
	if c != 201 || v["status"] != "New" {
		t.Fatal(c, v)
	}
	if c, _ := call(t, a, "POST", "/issues", newIssue, 1); c != 403 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/issues", `{"title":"Test","description":"Enough text","category":"Heating","location":{"entrance":12,"floor":5},"photo":"/media/seed/issue.png"}`, 4); c != 400 {
		t.Fatal(c)
	}
}
