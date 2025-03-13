use crate::errors::MembersError;
use crate::events::OwnershipTransferStarted;
use crate::MembersStore;
use crate::MEMBERS_SEED;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TransferOwnershipParams {
    pub new_owner: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: TransferOwnershipParams)]
pub struct TransferOwnership<'info> {
    #[account(
        mut,
        seeds = [MEMBERS_SEED],
        bump = members_store.bump,
        has_one = owner @ MembersError::Unauthorized
    )]
    pub members_store: Account<'info, MembersStore>,
    pub owner: Signer<'info>,
}

pub fn transfer_ownership(
    ctx: Context<TransferOwnership>,
    params: TransferOwnershipParams,
) -> Result<()> {
    let members_store = &mut ctx.accounts.members_store;
    require!(
        params.new_owner != Pubkey::default(),
        MembersError::InvalidOwner
    );
    members_store.pending_owner = params.new_owner;

    emit!(OwnershipTransferStarted {
        previous_owner: members_store.owner,
        new_owner: params.new_owner,
    });
    Ok(())
}
