use anchor_lang::prelude::*;

#[event]
pub struct CustodianBtcDepositAddressSet {
    pub merchant: Pubkey,
    pub custodian: Pubkey,
    pub btc_deposit_address: String,
}

#[event]
pub struct MerchantBtcDepositAddressSet {
    pub merchant: Pubkey,
    pub btc_deposit_address: String,
}

#[event]
pub struct MintRequestAdd {
    pub nonce: u64,
    pub requester: Pubkey,
    pub amount: u64,
    pub btc_deposit_address: String,
    pub btc_txid: String,
    pub timestamp: i64,
    pub request_hash: [u8; 32],
}

#[event]
pub struct MintRequestCancel {
    pub nonce: u64,
    pub requester: Pubkey,
    pub request_hash: [u8; 32],
}

#[event]
pub struct MintConfirmed {
    pub nonce: u64,
    pub requester: Pubkey,
    pub amount: u64,
    pub btc_deposit_address: String,
    pub btc_txid: String,
    pub timestamp: i64,
    pub request_hash: [u8; 32],
}

#[event]
pub struct MintRejected {
    pub nonce: u64,
    pub requester: Pubkey,
    pub amount: u64,
    pub btc_deposit_address: String,
    pub btc_txid: String,
    pub timestamp: i64,
    pub request_hash: [u8; 32],
}

#[event]
pub struct Burned {
    pub nonce: u64,
    pub requester: Pubkey,
    pub amount: u64,
    pub btc_deposit_address: String,
    pub timestamp: i64,
    pub request_hash: [u8; 32],
}

#[event]
pub struct BurnConfirmed {
    pub nonce: u64,
    pub requester: Pubkey,
    pub amount: u64,
    pub btc_deposit_address: String,
    pub btc_txid: String,
    pub timestamp: i64,
    pub request_hash: [u8; 32],
} 
