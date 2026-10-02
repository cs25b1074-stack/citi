package main

import (
	"log"
	"os"

	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	cc, err := contractapi.NewChaincode(&PulseContract{})
	if err != nil {
		log.Panicf("create chaincode: %v", err)
	}
	server := &shim.ChaincodeServer{
		CCID:     os.Getenv("CHAINCODE_ID"),
		Address:  os.Getenv("CHAINCODE_SERVER_ADDRESS"),
		CC:       cc,
		TLSProps: shim.TLSProperties{Disabled: true},
	}
	if err := server.Start(); err != nil {
		log.Panicf("start chaincode server: %v", err)
	}
}
