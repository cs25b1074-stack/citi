package main

import (
	"testing"

	"github.com/hyperledger/fabric-chaincode-go/pkg/statebased"
	"github.com/stretchr/testify/require"
)

var policies = map[string][]byte{}

func (s *fakeStub) SetStateValidationParameter(k string, ep []byte) error {
	policies[k] = ep
	return nil
}

func orgsOf(t *testing.T, key string) []string {
	raw, ok := policies[key]
	require.True(t, ok, "no endorsement policy set for %s", key)
	ep, err := statebased.NewStateEP(raw)
	require.NoError(t, err)
	return ep.ListOrgs()
}

func TestCreditedLocksToBeneficiary(t *testing.T) {
	e := newEnv()
	require.NoError(t, create(e.cc, e.as(o1)))
	require.NoError(t, debit(e.cc, e.as(o1)))
	require.NoError(t, credit(e.cc, e.as(o2)))
	require.Equal(t, []string{o2}, orgsOf(t, "p1"))
}

func TestDeclinedLocksToRemitter(t *testing.T) {
	e := newEnv()
	require.NoError(t, create(e.cc, e.as(o1)))
	require.NoError(t, decline(e.cc, e.as(o1)))
	require.Equal(t, []string{o1}, orgsOf(t, "p1"))
}

func TestDisputedLocksToBeneficiary(t *testing.T) {
	e := newEnv()
	require.NoError(t, create(e.cc, e.as(o1)))
	require.NoError(t, debit(e.cc, e.as(o1)))
	require.NoError(t, reverse(e.cc, e.as(o1)))
	require.NoError(t, credit(e.cc, e.as(o2)))
	require.Equal(t, []string{o2}, orgsOf(t, "p1"))
}

func TestReversedIsNotLocked(t *testing.T) {
	e := newEnv()
	require.NoError(t, create(e.cc, e.as(o1)))
	require.NoError(t, debit(e.cc, e.as(o1)))
	require.NoError(t, reverse(e.cc, e.as(o1)))
	_, locked := policies["p1"]
	require.False(t, locked)
}
