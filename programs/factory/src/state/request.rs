use anchor_lang::prelude::*;
use solana_program::keccak::hashv;

#[account]
#[derive(InitSpace, Debug)]
pub struct RequestAccount {
    pub request_type: RequestType, // Mint or Burn
    pub requester: Pubkey,
    pub amount: u64,
    #[max_len(62)]
    pub btc_deposit_address: String,
    #[max_len(64)]
    pub btc_txid: String,
    pub nonce: u64,
    pub timestamp: i64,
    pub status: RequestStatus,
    pub hash: [u8; 32],
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace, Debug)]
pub enum RequestType {
    Mint,
    Burn,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace, Debug)]
pub enum RequestStatus {
    Pending,
    Canceled,
    Approved,
    Rejected,
}

impl RequestAccount {
    pub fn calculate_hash(&self) -> [u8; 32] {
        let mut data = vec![];
        data.extend_from_slice(self.requester.as_ref());
        data.extend_from_slice(&self.amount.to_le_bytes());
        data.extend_from_slice(self.btc_deposit_address.as_bytes());
        data.extend_from_slice(self.btc_txid.as_bytes());
        data.extend_from_slice(&self.nonce.to_le_bytes());
        data.extend_from_slice(&self.timestamp.to_le_bytes());
        hashv(&[&data]).0
    }
}
