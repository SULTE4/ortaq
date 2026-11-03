package app

import (
	"context"
	"sync"
	"testing"
)

func TestOneVotePerApartment(t *testing.T) {
	a := testAPI(t)
	a.Store.Update(context.Background(), func(s *State) error {
		s.Users = append(s.Users, User{6, "+77000000099", "Second resident", "resident", 1, 45})
		return nil
	})
	var wg sync.WaitGroup
	codes := make(chan int, 2)
	for _, id := range []int{4, 6} {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			c, _ := call(t, a, "POST", "/polls/poll-open/votes", `{"option":0}`, id)
			codes <- c
		}(id)
	}
	wg.Wait()
	close(codes)
	success, duplicate := 0, 0
	for c := range codes {
		if c == 201 {
			success++
		}
		if c == 409 {
			duplicate++
		}
	}
	if success != 1 || duplicate != 1 {
		t.Fatal(success, duplicate)
	}
	if c, _ := call(t, a, "POST", "/polls/poll-closed/votes", `{"option":0}`, 4); c != 409 {
		t.Fatal(c)
	}
	a.Store.View(context.Background(), func(s *State) error {
		polls := s.pollsFor(s.user(4), a.Now())
		if _, ok := polls[0]["results"]; ok {
			t.Fatal("open results leaked")
		}
		if _, ok := polls[0]["votes"]; ok {
			t.Fatal("ballots leaked")
		}
		if polls[1]["results"].([]int)[0] != 68 {
			t.Fatal(polls[1])
		}
		return nil
	})
	if c, _ := call(t, a, "POST", "/polls/poll-open/votes", `{"option":9}`, 3); c != 400 {
		t.Fatal(c)
	}
}
