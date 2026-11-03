package app

import "testing"

func TestFeedback(t *testing.T) {
	a := testAPI(t)
	if c, _ := call(t, a, "POST", "/feedback", `{"message":"Please keep the new reports chart."}`, 4); c != 201 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "GET", "/feedback", "", 4); c != 403 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "GET", "/feedback", "", 1); c != 200 {
		t.Fatal(c)
	}
}
