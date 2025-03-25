use anchor_lang::prelude::*;

#[derive(InitSpace, Debug)]
#[account]
pub struct ControllerStore {
    pub bump: u8,
    pub token_mint: Pubkey,
    pub members: Pubkey,
    pub factory: Pubkey,
    pub owner: Pubkey,
    pub pending_owner: Pubkey,
    pub pending_mint_authority: Pubkey,
}
