use crate::events::MembersInitialized;
use crate::state::MembersStore;
use crate::MEMBERS_SEED;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + MembersStore::INIT_SPACE,
        seeds = [MEMBERS_SEED],
        bump
    )]
    pub members_store: Account<'info, MembersStore>,
    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    // Initialize Members account
    let members_store = &mut ctx.accounts.members_store;
    members_store.owner = ctx.accounts.payer.key();
    members_store.custodian = Pubkey::default();
    members_store.merchant_count = 0;
    members_store.pending_owner = Pubkey::default();
    members_store.bump = ctx.bumps.members_store;

    emit!(MembersInitialized {
        owner: ctx.accounts.payer.key(),
        bump: ctx.bumps.members_store,
    });
    Ok(())
}
