.PHONY: help install network-up network-down gateway-mock web-dev bench-baseline bench-pulse test demo clean

help:
	@echo "Pulse - Real-Time Verified Payment Status on a Shared Ledger"
	@echo "Commands:"
	@echo "  make install         Install dependencies for gateway, web, and bench"
	@echo "  make gateway-mock    Run the gateway in mock mode (port 4000)"
	@echo "  make web-dev         Run the web frontend dev server (port 5173)"
	@echo "  make bench-baseline  Run the HTTP polling baseline benchmark"
	@echo "  make bench-pulse     Run the Pulse push benchmark"
	@echo "  make test            Run all unit tests"
	@echo "  make network-up      Bring up the 3-org Fabric network & chaincode"
	@echo "  make network-down    Tear down the Fabric network"
	@echo "  make demo            Bring up network and run services via Docker Compose"

install:
	cd gateway && npm install
	cd web && npm install
	cd bench && npm install

network-up:
	./network/up.sh

network-down:
	./network/down.sh

gateway-mock:
	cd gateway && npm run mock

web-dev:
	cd web && npm run dev

bench-baseline:
	cd bench && npm run baseline

bench-pulse:
	cd bench && npm run pulse

test:
	cd gateway && npm test
	cd web && npm test

demo:
	docker compose up --build
