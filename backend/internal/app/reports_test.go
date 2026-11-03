package app

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
)

func TestReportImmutability(t *testing.T) {
	a := testAPI(t)
	body := `{"month":"2026-11","expenses":[{"category":"Cleaning","amount":240000,"date":"2026-11-05","receipt":"/media/seed/receipt.png","description":"invoice"}]}`
	if c, _ := call(t, a, "POST", "/reports", body, 3); c != 403 {
		t.Fatal(c)
	}
	c, v := call(t, a, "POST", "/reports", body, 1)
	if c != 201 {
		t.Fatal(c, v)
	}
	id := v["id"].(string)
	if c, _ = call(t, a, "POST", "/reports", body, 1); c != 409 {
		t.Fatal(c)
	}
	if c, _ = call(t, a, "DELETE", "/reports/"+id, "", 1); c == 200 {
		t.Fatal("deleted published report")
	}
	correction := `{"note":"Updated invoice amount","expenses":[{"category":"Cleaning","amount":250000,"date":"2026-11-05","receipt":"/media/seed/receipt.png"}]}`
	if c, v = call(t, a, "POST", "/reports/"+id+"/corrections", correction, 1); c != 200 {
		t.Fatal(c, v)
	}
	a.Store.View(context.Background(), func(s *State) error {
		if s.Reports[0].Expenses[0].Amount != 240000 || effective(s.Reports[0])[0].Amount != 250000 {
			t.Fatal("original report overwritten")
		}
		return nil
	})
	for _, amount := range []int64{0, -1, 1000000001} {
		invalid := fmt.Sprintf(`{"month":"2026-12","expenses":[{"category":"Cleaning","amount":%d,"date":"2026-12-01","receipt":"/media/seed/receipt.png"}]}`, amount)
		if c, _ := call(t, a, "POST", "/reports", invalid, 1); c != 400 {
			t.Fatal(c)
		}
	}
	b, _ := json.Marshal(Seed(a.Now()).Reports)
	if len(b) == 0 {
		t.Fatal("missing report seeds")
	}
}
