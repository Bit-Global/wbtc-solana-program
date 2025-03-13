use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct FactoryStore {
    pub mint_request_counter: u64,
    pub burn_request_counter: u64,
    pub controller: Pubkey,
    pub bump: u8,
}
