use crate::errors::CustomError;
use crate::events::OwnershipTransferStarted;
use crate::ControllerStore;
use crate::CONTROLLER_SEED;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TransferOwnershipParams {
    pub new_owner: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: TransferOwnershipParams)]
pub struct SetOwnerContext<'info> {
    #[account(
        mut,
        seeds = [CONTROLLER_SEED],
        bump = controller_store.bump,
        has_one = owner @ CustomError::Unauthorized
    )]
    pub controller_store: Account<'info, ControllerStore>,
    pub owner: Signer<'info>,
}

pub fn transfer_ownership(
    ctx: Context<SetOwnerContext>,
    params: TransferOwnershipParams,
) -> Result<()> {
    let controller_store = &mut ctx.accounts.controller_store;
    require!(
        params.new_owner != Pubkey::default(),
        CustomError::InvalidOwner
    );
    controller_store.pending_owner = params.new_owner;

    emit!(OwnershipTransferStarted {
        previous_owner: controller_store.owner,
        new_owner: params.new_owner,
    });
    Ok(())
}
