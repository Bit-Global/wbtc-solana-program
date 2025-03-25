use anchor_lang::prelude::*;

#[derive(InitSpace, Debug)]
#[account]
pub struct MembersStore {
    pub owner: Pubkey,                 // owner's public key
    pub custodian: Pubkey,             // custodian's public key
    pub merchant_count: u16,           // merchant count (kept for statistics)
    pub pending_owner: Pubkey,         // pending owner's public key for ownership transfer
    pub bump: u8,                      // PDA bump value
}

impl MembersStore {
    // Check if address is custodian
    pub fn is_custodian(&self, address: &Pubkey) -> bool {
        &self.custodian == address
    }
}
