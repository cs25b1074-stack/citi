# Pulse — agent instructions

Pulse is a verified, push-based payment status layer on a Hyperledger Fabric 2.5
(Drunix) ledger. Hackathon project; all banks and data are simulated.

## Read first
- docs/contracts.md is the frozen interface between team members. Never change
  a contract shape. If it must change, stop and tell the human.

## Ownership (edit only the folder the human names)
- chaincode/, network/        -> Dharmik (Go, Bash)
- gateway/, simulators/       -> Ritu (TypeScript, Node 20)
- web/, bench/, docs/, root files, .github/ -> Mithunn (React + Vite + TS)
Never edit another owner's folder. Never edit root files unless the human says
they are Mithunn.

## Stack
- Chaincode: Go, fabric-contract-api-go. Use the tx timestamp, never time.Now().
- Gateway/simulators: TypeScript ESM, @hyperledger/fabric-gateway, express, ws,
  better-sqlite3, zod, vitest.
- Web: React 18, Vite, Tailwind v4, react-router-dom, recharts.
- Ports: gateway 4000, simulators 4100, web 5173.

## Rules
- Small changes. Explain the plan in 3-5 lines before editing many files.
- Add or update tests with the code. Run them before saying you are done.
- Never commit or print secrets: .env, *.pem, *.key, crypto-config, wallets,
  network/out. Never paste key material into chat.
- Do not run destructive commands (rm -rf outside build dirs, git push --force,
  git reset --hard, docker system prune) without asking.
- Work on the human's feature branch. Never commit to main. Never push; the
  human pushes and opens the PR.
- Do not add dependencies without saying so; shared files need Mithunn's OK.
- Do not invent benchmark numbers, Drunix behaviour or UPI facts. If unknown,
  say so.
- Match the existing style. Keep functions short and typed.
