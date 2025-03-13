use crate::errors::CustomError;
use crate::events::MembersSet;
use crate::ControllerStore;
use crate::CONTROLLER_SEED;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SetMembersParams {
    pub members: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: SetMembersParams)]
pub struct SetMembers<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [CONTROLLER_SEED],
        bump = controller_store.bump,
        has_one = owner @ CustomError::Unauthorized
    )]
    pub controller_store: Account<'info, ControllerStore>,
}

pub fn set_members(ctx: Context<SetMembers>, params: SetMembersParams) -> Result<()> {
    let controller_store = &mut ctx.accounts.controller_store;
    require!(
        params.members != Pubkey::default(),
        CustomError::InvalidMembersAddress
    );
    controller_store.members = params.members;
    emit!(MembersSet {
        members: params.members
    });
    Ok(())
}
