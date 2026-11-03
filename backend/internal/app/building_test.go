package app

import "testing"

func TestInvites(t *testing.T) {
	a := testAPI(t)
	if c, _ := call(t, a, "GET", "/invites", "", 3); c != 403 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/buildings", `{"name":"New home","address":"Astana","entrances":1,"floors":9,"apartments":12}`, 3); c != 403 {
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
	if c, _ := call(t, a, "POST", "/buildings", `{"name":"New home","address":"Astana","entrances":1,"floors":9,"apartments":12}`, 1); c != 201 {
		t.Fatal(c)
	}
	if c, _ := call(t, a, "POST", "/invites/ORTAQ-012/revoke", `{}`, 1); c != 404 {
		t.Fatal("cross building invite", c)
	}
}
