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

1. Merchant initiates a mint request to the Factory program
2. Custodian sets the BTC deposit address
3. User sends BTC to the deposit address
4. Custodian confirms the BTC transaction
5. Factory program calls the Controller program to mint an equivalent amount of wBTC tokens

### wBTC Burning Flow:

1. Merchant sets their BTC deposit address
2. Merchant initiates a burn request (locking wBTC tokens)
3. Custodian processes the request, sending the corresponding amount of BTC to the merchant's BTC address
4. Custodian confirms the BTC transaction
5. wBTC tokens are burned

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
