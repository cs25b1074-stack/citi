package main

import (
	"testing"
	"time"

	"github.com/hyperledger/fabric-chaincode-go/pkg/cid"
	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// ---- in-memory fakes (embed the interface, override only what we use) ----

type fakeStub struct {
	shim.ChaincodeStubInterface
	state  map[string][]byte
	now    time.Time
	events []string
}

func (s *fakeStub) GetState(k string) ([]byte, error)    { return s.state[k], nil }
func (s *fakeStub) PutState(k string, v []byte) error    { s.state[k] = v; return nil }
func (s *fakeStub) SetEvent(n string, _ []byte) error    { s.events = append(s.events, n); return nil }
func (s *fakeStub) GetTxID() string                      { return "tx-test" }
func (s *fakeStub) GetTxTimestamp() (*timestamppb.Timestamp, error) {
	return timestamppb.New(s.now), nil
}

type fakeID struct {
	cid.ClientIdentity
	msp string
}

func (f fakeID) GetMSPID() (string, error) { return f.msp, nil }

type env struct {
	stub *fakeStub
	cc   *PulseContract
}

func newEnv() *env {
	return &env{
		stub: &fakeStub{state: map[string][]byte{}, now: time.Date(2026, 10, 4, 10, 0, 0, 0, time.UTC)},
		cc:   &PulseContract{},
	}
}

func (e *env) as(msp string) *contractapi.TransactionContext {
	ctx := &contractapi.TransactionContext{}
	ctx.SetStub(e.stub)
	ctx.SetClientIdentity(fakeID{msp: msp})
	return ctx
}

// ---- step helpers ----

type call func(c *PulseContract, ctx txCtx) error

var (
	create   call = func(c *PulseContract, ctx txCtx) error { return c.CreatePayment(ctx, "p1", "Org1MSP", "Org2MSP", 30) }
	debit    call = func(c *PulseContract, ctx txCtx) error { return c.ReportDebited(ctx, "p1") }
	credit   call = func(c *PulseContract, ctx txCtx) error { return c.ReportCredited(ctx, "p1") }
	reverse  call = func(c *PulseContract, ctx txCtx) error { return c.ReportReversed(ctx, "p1") }
	decline  call = func(c *PulseContract, ctx txCtx) error { return c.ReportDeclined(ctx, "p1") }
	deadline call = func(c *PulseContract, ctx txCtx) error { return c.CheckDeadline(ctx, "p1") }
)

type step struct {
	org     string
	do      call
	wait    time.Duration
	wantErr bool
}

func ok(org string, do call) step                       { return step{org: org, do: do} }
func fail(org string, do call) step                     { return step{org: org, do: do, wantErr: true} }
func okAfter(org string, do call, d time.Duration) step { return step{org: org, do: do, wait: d} }
func failAfter(org string, do call, d time.Duration) step {
	return step{org: org, do: do, wait: d, wantErr: true}
}

const (
	o1 = "Org1MSP"
	o2 = "Org2MSP"
	o3 = "Org3MSP"
)

func TestStateMachine(t *testing.T) {
	cases := []struct {
		name      string
		steps     []step
		wantState string
		wantHeld  string
	}{
		{"happy path", []step{ok(o1, create), ok(o1, debit), ok(o2, credit)}, StateCredited, ""},
		{"declined", []step{ok(o1, create), ok(o1, decline)}, StateDeclined, ""},
		{"reversed", []step{ok(o1, create), ok(o1, debit), ok(o1, reverse)}, StateReversed, ""},
		{"late credit after reversal is disputed", []step{ok(o1, create), ok(o1, debit), ok(o1, reverse), ok(o2, credit)}, StateDisputed, ""},
		{"debited is held by beneficiary", []step{ok(o1, create), ok(o1, debit)}, StateDebited, o2},
		{"initiated is held by remitter", []step{ok(o1, create)}, StateInitiated, o1},
		{"deadline passes -> stuck", []step{ok(o1, create), ok(o1, debit), okAfter(o3, deadline, 31 * time.Second)}, StateStuck, o2},
		{"stuck then credited", []step{ok(o1, create), ok(o1, debit), okAfter(o1, deadline, 31 * time.Second), ok(o2, credit)}, StateCredited, ""},
		{"stuck then reversed", []step{ok(o1, create), ok(o1, debit), okAfter(o1, deadline, 31 * time.Second), ok(o1, reverse)}, StateReversed, ""},

		// wrong org
		{"org3 cannot create", []step{fail(o3, create)}, "", ""},
		{"beneficiary cannot create", []step{fail(o2, create)}, "", ""},
		{"beneficiary cannot debit", []step{ok(o1, create), fail(o2, debit)}, StateInitiated, o1},
		{"beneficiary cannot decline", []step{ok(o1, create), fail(o2, decline)}, StateInitiated, o1},
		{"remitter cannot credit", []step{ok(o1, create), ok(o1, debit), fail(o1, credit)}, StateDebited, o2},
		{"beneficiary cannot reverse", []step{ok(o1, create), ok(o1, debit), fail(o2, reverse)}, StateDebited, o2},
		{"regulator cannot debit", []step{ok(o1, create), fail(o3, debit)}, StateInitiated, o1},
		{"regulator cannot credit", []step{ok(o1, create), ok(o1, debit), fail(o3, credit)}, StateDebited, o2},

		// invalid transitions
		{"credit before debit", []step{ok(o1, create), fail(o2, credit)}, StateInitiated, o1},
		{"debit twice", []step{ok(o1, create), ok(o1, debit), fail(o1, debit)}, StateDebited, o2},
		{"decline after debit", []step{ok(o1, create), ok(o1, debit), fail(o1, decline)}, StateDebited, o2},
		{"credit twice", []step{ok(o1, create), ok(o1, debit), ok(o2, credit), fail(o2, credit)}, StateCredited, ""},
		{"duplicate create", []step{ok(o1, create), fail(o1, create)}, StateInitiated, o1},
		{"deadline too early", []step{ok(o1, create), ok(o1, debit), failAfter(o1, deadline, 5 * time.Second)}, StateDebited, o2},
		{"deadline on initiated", []step{ok(o1, create), fail(o1, deadline)}, StateInitiated, o1},
		{"reverse after credited", []step{ok(o1, create), ok(o1, debit), ok(o2, credit), fail(o1, reverse)}, StateCredited, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := newEnv()
			for i, s := range tc.steps {
				e.stub.now = e.stub.now.Add(s.wait)
				err := s.do(e.cc, e.as(s.org))
				if s.wantErr {
					require.Error(t, err, "step %d should fail", i)
				} else {
					require.NoError(t, err, "step %d should succeed", i)
				}
			}
			if tc.wantState == "" {
				_, err := e.cc.GetPayment(e.as(o3), "p1")
				require.Error(t, err)
				return
			}
			p, err := e.cc.GetPayment(e.as(o3), "p1")
			require.NoError(t, err)
			require.Equal(t, tc.wantState, p.State)
			require.Equal(t, tc.wantHeld, p.HeldBy)
		})
	}
}

func TestEventsEmittedOnEveryTransition(t *testing.T) {
	e := newEnv()
	require.NoError(t, create(e.cc, e.as(o1)))
	require.NoError(t, debit(e.cc, e.as(o1)))
	require.NoError(t, credit(e.cc, e.as(o2)))
	require.Equal(t, []string{"PaymentStateChanged", "PaymentStateChanged", "PaymentStateChanged"}, e.stub.events)
}

func TestFailedCallEmitsNoEvent(t *testing.T) {
	e := newEnv()
	require.NoError(t, create(e.cc, e.as(o1)))
	before := len(e.stub.events)
	require.Error(t, debit(e.cc, e.as(o2)))
	require.Equal(t, before, len(e.stub.events))
}

func TestDeadlineUsesTxTimestamp(t *testing.T) {
	e := newEnv()
	require.NoError(t, create(e.cc, e.as(o1)))
	require.NoError(t, debit(e.cc, e.as(o1)))
	p, err := e.cc.GetPayment(e.as(o1), "p1")
	require.NoError(t, err)
	require.Equal(t, "2026-10-04T10:00:30Z", p.DeadlineAt)
}

func TestInvalidCreateArguments(t *testing.T) {
	e := newEnv()
	require.Error(t, e.cc.CreatePayment(e.as(o1), "", o1, o2, 30))
	require.Error(t, e.cc.CreatePayment(e.as(o1), "x", o1, o1, 30))
	require.Error(t, e.cc.CreatePayment(e.as(o1), "x", o1, o2, 0))
}
