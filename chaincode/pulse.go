package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

const (
	StateInitiated = "INITIATED"
	StateDebited   = "DEBITED"
	StateCredited  = "CREDITED"
	StateReversed  = "REVERSED"
	StateDeclined  = "DECLINED"
	StateStuck     = "STUCK"
	StateDisputed  = "DISPUTED"
)

type Payment struct {
	ID              string `json:"id"`
	State           string `json:"state"`
	RemitterOrg     string `json:"remitterOrg"`
	BeneficiaryOrg  string `json:"beneficiaryOrg"`
	HeldBy          string `json:"heldBy"`
	DeadlineSeconds int    `json:"deadlineSeconds"`
	DeadlineAt      string `json:"deadlineAt"`
	UpdatedAt       string `json:"updatedAt"`
}

type PaymentEvent struct {
	ID         string `json:"id"`
	State      string `json:"state"`
	HeldBy     string `json:"heldBy"`
	DeadlineAt string `json:"deadlineAt"`
	TxID       string `json:"txId"`
	At         string `json:"at"`
}

type PulseContract struct {
	contractapi.Contract
}

type txCtx = contractapi.TransactionContextInterface

func txTime(ctx txCtx) (time.Time, error) {
	ts, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return time.Time{}, err
	}
	return ts.AsTime().UTC(), nil
}

func requireOrg(ctx txCtx, want string) error {
	got, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("cannot read caller identity: %w", err)
	}
	if got != want {
		return fmt.Errorf("caller %s not allowed, %s required", got, want)
	}
	return nil
}

func load(ctx txCtx, id string) (*Payment, error) {
	raw, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, err
	}
	if raw == nil {
		return nil, fmt.Errorf("payment %s not found", id)
	}
	var p Payment
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func save(ctx txCtx, p *Payment) error {
	t, err := txTime(ctx)
	if err != nil {
		return err
	}
	p.UpdatedAt = t.Format(time.RFC3339)
	raw, err := json.Marshal(p)
	if err != nil {
		return err
	}
	if err := ctx.GetStub().PutState(p.ID, raw); err != nil {
		return err
	}
	ev, err := json.Marshal(PaymentEvent{
		ID: p.ID, State: p.State, HeldBy: p.HeldBy,
		DeadlineAt: p.DeadlineAt, TxID: ctx.GetStub().GetTxID(), At: p.UpdatedAt,
	})
	if err != nil {
		return err
	}
	return ctx.GetStub().SetEvent("PaymentStateChanged", ev)
}

func (c *PulseContract) CreatePayment(ctx txCtx, id, remitterOrg, beneficiaryOrg string, deadlineSeconds int) error {
	if id == "" || remitterOrg == "" || beneficiaryOrg == "" || remitterOrg == beneficiaryOrg {
		return fmt.Errorf("invalid arguments")
	}
	if deadlineSeconds <= 0 {
		return fmt.Errorf("deadlineSeconds must be positive")
	}
	if err := requireOrg(ctx, remitterOrg); err != nil {
		return err
	}
	existing, err := ctx.GetStub().GetState(id)
	if err != nil {
		return err
	}
	if existing != nil {
		return fmt.Errorf("payment %s already exists", id)
	}
	p := &Payment{
		ID: id, State: StateInitiated, RemitterOrg: remitterOrg,
		BeneficiaryOrg: beneficiaryOrg, HeldBy: remitterOrg, DeadlineSeconds: deadlineSeconds,
	}
	return save(ctx, p)
}

func (c *PulseContract) ReportDebited(ctx txCtx, id string) error {
	p, err := load(ctx, id)
	if err != nil {
		return err
	}
	if err := requireOrg(ctx, p.RemitterOrg); err != nil {
		return err
	}
	if p.State != StateInitiated {
		return fmt.Errorf("cannot debit from state %s", p.State)
	}
	t, err := txTime(ctx)
	if err != nil {
		return err
	}
	p.State = StateDebited
	p.HeldBy = p.BeneficiaryOrg
	p.DeadlineAt = t.Add(time.Duration(p.DeadlineSeconds) * time.Second).Format(time.RFC3339)
	return save(ctx, p)
}

func (c *PulseContract) ReportDeclined(ctx txCtx, id string) error {
	p, err := load(ctx, id)
	if err != nil {
		return err
	}
	if err := requireOrg(ctx, p.RemitterOrg); err != nil {
		return err
	}
	if p.State != StateInitiated {
		return fmt.Errorf("cannot decline from state %s", p.State)
	}
	p.State = StateDeclined
	p.HeldBy = ""
	return save(ctx, p)
}

func (c *PulseContract) ReportCredited(ctx txCtx, id string) error {
	p, err := load(ctx, id)
	if err != nil {
		return err
	}
	if err := requireOrg(ctx, p.BeneficiaryOrg); err != nil {
		return err
	}
	switch p.State {
	case StateDebited, StateStuck:
		p.State = StateCredited
	case StateReversed:
		p.State = StateDisputed
	default:
		return fmt.Errorf("cannot credit from state %s", p.State)
	}
	p.HeldBy = ""
	return save(ctx, p)
}

func (c *PulseContract) ReportReversed(ctx txCtx, id string) error {
	p, err := load(ctx, id)
	if err != nil {
		return err
	}
	if err := requireOrg(ctx, p.RemitterOrg); err != nil {
		return err
	}
	if p.State != StateDebited && p.State != StateStuck {
		return fmt.Errorf("cannot reverse from state %s", p.State)
	}
	p.State = StateReversed
	p.HeldBy = ""
	return save(ctx, p)
}

func (c *PulseContract) CheckDeadline(ctx txCtx, id string) error {
	p, err := load(ctx, id)
	if err != nil {
		return err
	}
	if p.State != StateDebited {
		return fmt.Errorf("deadline check only applies to DEBITED, got %s", p.State)
	}
	deadline, err := time.Parse(time.RFC3339, p.DeadlineAt)
	if err != nil {
		return err
	}
	now, err := txTime(ctx)
	if err != nil {
		return err
	}
	if !now.After(deadline) {
		return fmt.Errorf("deadline not reached yet")
	}
	p.State = StateStuck
	return save(ctx, p)
}

func (c *PulseContract) GetPayment(ctx txCtx, id string) (*Payment, error) {
	return load(ctx, id)
}
