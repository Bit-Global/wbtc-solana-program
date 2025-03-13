use crate::errors::MembersError;
use crate::events::OwnershipTransferred;
use crate::MembersStore;
use crate::MEMBERS_SEED;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction()]
pub struct ClaimOwnership<'info> {
    #[account(
        mut,
        seeds = [MEMBERS_SEED],
        bump = members_store.bump,
        constraint = members_store.pending_owner == pending_owner.key() @ MembersError::InvalidPendingOwner
    )]
    pub members_store: Account<'info, MembersStore>,
    pub pending_owner: Signer<'info>,
}

pub fn claim_ownership(ctx: Context<ClaimOwnership>) -> Result<()> {
    let members_store = &mut ctx.accounts.members_store;
    let pending_owner = members_store.pending_owner;

    require!(
        pending_owner != Pubkey::default(),
        MembersError::NoPendingOwner
    );

    let previous_owner = members_store.owner;
    members_store.owner = pending_owner;
    members_store.pending_owner = Pubkey::default();

    emit!(OwnershipTransferred {
        previous_owner,
        new_owner: pending_owner,
    });
    Ok(())
}
