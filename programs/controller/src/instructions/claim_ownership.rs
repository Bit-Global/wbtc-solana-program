use crate::errors::CustomError;
use crate::events::OwnershipTransferred;
use crate::ControllerStore;
use crate::CONTROLLER_SEED;
use anchor_lang::prelude::*;
#[derive(Accounts)]
#[instruction()]
pub struct ClaimOwnershipContext<'info> {
    #[account(
        mut,
        seeds = [CONTROLLER_SEED],
        bump = controller_store.bump,
        constraint = controller_store.pending_owner == pending_owner.key() @ CustomError::InvalidPendingOwner
    )]
    pub controller_store: Account<'info, ControllerStore>,
    pub pending_owner: Signer<'info>,
}

pub fn claim_ownership(ctx: Context<ClaimOwnershipContext>) -> Result<()> {
    let controller_store = &mut ctx.accounts.controller_store;
    let pending_owner = controller_store.pending_owner;

    require!(
        pending_owner != Pubkey::default(),
        CustomError::NoPendingOwner
    );

    let previous_owner = controller_store.owner;
    controller_store.owner = pending_owner;
    controller_store.pending_owner = Pubkey::default();
    controller_store.pending_owner_program = Pubkey::default();

    emit!(OwnershipTransferred {
        previous_owner,
        new_owner: pending_owner,
    });
    Ok(())
}
