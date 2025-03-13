use anchor_lang::prelude::*;

#[derive(InitSpace, Debug)]
#[account]
pub struct MerchantInfo {
    pub merchant: Pubkey,      // merchant public key
    pub bump: u8,              // PDA bump value for future verification
}
