use anchor_lang::prelude::*;

#[event]
pub struct CustodianBtcDepositAddressSet {
    #[index]
    pub merchant: Pubkey,
    #[index]
    pub btc_deposit_address: String,
}

#[event]
pub struct MerchantBtcDepositAddressSet {
    #[index]
    pub merchant: Pubkey,
    pub btc_deposit_address: String,
}

#[event]
pub struct MintRequestAdd {
    #[index]
    pub nonce: u64,
    #[index]
    pub requester: Pubkey,
    pub amount: u64,
    pub btc_deposit_address: String,
    pub btc_txid: String,
    pub timestamp: i64,
    pub request_hash: [u8; 32],
}

#[event]
pub struct MintRequestCancel {
    #[index]
    pub nonce: u64,
    #[index]
    pub requester: Pubkey,
    pub request_hash: [u8; 32],
}

#[event]
pub struct MintConfirmed {
    #[index]
    pub nonce: u64,
    #[index]
    pub requester: Pubkey,
    pub amount: u64,
    pub btc_deposit_address: String,
    pub btc_txid: String,
    pub timestamp: i64,
    pub request_hash: [u8; 32],
}

#[event]
pub struct MintRejected {
    #[index]
    pub nonce: u64,
    #[index]
    pub requester: Pubkey,
    pub amount: u64,
    pub btc_deposit_address: String,
    pub btc_txid: String,
    pub timestamp: i64,
    pub request_hash: [u8; 32],
}

#[event]
pub struct Burned {
    #[index]
    pub nonce: u64,
    #[index]
    pub requester: Pubkey,
    pub amount: u64,
    pub btc_deposit_address: String,
    pub timestamp: i64,
    pub request_hash: [u8; 32],
}

#[event]
pub struct BurnConfirmed {
    #[index]
    pub nonce: u64,
    #[index]
    pub requester: Pubkey,
    pub amount: u64,
    pub btc_deposit_address: String,
    pub btc_txid: String,
    pub timestamp: i64,
    pub request_hash: [u8; 32],
} 