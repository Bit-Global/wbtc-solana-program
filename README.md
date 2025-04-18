# Solana wBTC Protocol

This project implements a cross-chain Bitcoin wrapped token (wBTC) system, using smart contracts on the Solana blockchain to manage assets based on the Bitcoin network. The project consists of three main Solana programs that work together to provide complete functionality.

## Architecture Overview

The system consists of three interconnected Solana programs:

### 1. Controller Program

The Controller program is the core of the system, responsible for:

- Managing wBTC token minting and burning permission controls
- Interacting with the SPL token standard
- Maintaining system configuration

**Main Functions:**

- Initializing the system
- Setting Members and Factory program addresses
- Minting and burning wBTC tokens
- Transferring ownership
- Transferring minting authority

### 2. Members Program

The Members program manages roles and permissions within the system. It maintains a list of authorized merchants, ensuring that only approved entities can perform minting and burning operations.

**Main Functions:**

- Initializing the members system
- Setting the Custodian
- Adding and removing merchants
- Transferring ownership
- Adjusting merchant list size

### 3. Factory Program

The Factory program handles minting and burning requests from end users and serves as a bridge between the BTC network and the Solana chain.

**Main Functions:**

- Setting BTC deposit addresses (for minting and burning)
- Processing mint requests (add, cancel, confirm, reject)
- Processing burn requests
- Confirming BTC transactions

## Interaction Flows

### wBTC Minting Flow:

1. **Initialization Phase**:

   - Custodian sets the merchant's BTC deposit address via `setCustodianBtcDepositAddress`

2. **Mint Request Phase**:

   - Merchant sends BTC to the Custodian's designated BTC address (obtains transaction ID)
   - Merchant initiates a mint request to the Factory program via `addMintRequest` (amount, btcTxid, btcDepositAddress)
   - Factory program creates a mint request with status set to PENDING

3. **Request Processing Phase**:
   - Merchant can cancel the mint request via `cancelMintRequest`
   - Custodian can reject the mint request via `rejectMintRequest`
   - Custodian confirms the mint request via `confirmMintRequest`, and Factory program calls Controller program to mint an equivalent amount of wBTC tokens

### wBTC Burning Flow:

1. **Initialization Phase**:

   - Merchant sets their own BTC withdrawal address via `setMerchantBtcDepositAddress`

2. **Burn Request Phase**:

   - Merchant initiates a burn request via `burn`, Factory program creates a burn request (status set to PENDING)
   - Factory program burns the user's wBTC tokens

3. **Request Processing Phase**:
   - Custodian queries the merchant's BTC address
   - Custodian sends the corresponding amount of BTC to the merchant's BTC address
   - Custodian confirms the burn request via `confirmBurnRequest` (providing btcTxid), updating the request status to APPROVED

## Security Model

The system employs a multi-layer authorization model:

- Controller program owner controls critical parameters of the entire system
- Members program maintains the list of authorized merchants
- Custodian is responsible for verifying BTC transactions
- Only authorized merchants can initiate minting and burning requests

## Program IDs

- Controller: `3pVBN6dAvQMp7xG73t2y2isiEcZGqkyjXkySW6SdrG6v`
- Members: `2JzLi3jJyQrXSDGY1AVbwWxbGZM29DeodKMCzABhhpJu`
- Factory: `9uBZoRp8tbHy8Bngm1C3AhLfTD5ERsbfdHohEHkjyc68`

## Deployment and Usage

To deploy and use these programs:

1. First deploy the Controller program
2. Deploy the Members program
3. Deploy the Factory program
4. Initialize the Controller program
5. Initialize the Members program
6. Initialize the Factory program
7. Set the Members and Factory addresses in the Controller

## Development

This project is developed using the Anchor framework. Please ensure you have the latest version of the Solana toolchain and Anchor installed.

### Build

```bash
anchor build
```

### Test

```bash
anchor test
```

### Deploy

```bash
anchor deploy
```
