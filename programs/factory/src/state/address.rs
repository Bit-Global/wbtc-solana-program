use anchor_lang::prelude::*;

// BTC deposit address set by custodian for merchant
#[account]
#[derive(InitSpace)]
pub struct CustodianBtcDepositAddress {
    pub merchant: Pubkey,
    #[max_len(62)]
    pub btc_address: String,
    pub bump: u8,
}

// BTC deposit address set by merchant themselves
#[account]
#[derive(InitSpace)]
pub struct MerchantBtcDepositAddress {
    pub merchant: Pubkey,
    #[max_len(62)]
    pub btc_address: String,
    pub bump: u8,
} 