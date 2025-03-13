use anchor_lang::prelude::*;
use crate::errors::MembersError;
use crate::events::CustodianSet;
use crate::state::MembersStore;
use crate::MEMBERS_SEED;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SetCustodianParams {
    pub custodian: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: SetCustodianParams)]
pub struct SetCustodian<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut, 
        has_one = owner @ MembersError::Unauthorized,
        seeds = [MEMBERS_SEED],
        bump = members_store.bump
    )]
    pub members_store: Account<'info, MembersStore>,
    pub system_program: Program<'info, System>,
}

pub fn set_custodian(
    ctx: Context<SetCustodian>,
    params: SetCustodianParams,
) -> Result<()> {
    require!(params.custodian != Pubkey::default(), MembersError::InvalidAddress);

    let members_store = &mut ctx.accounts.members_store;
    members_store.custodian = params.custodian;

    emit!(CustodianSet {
        custodian: params.custodian,
    });
    Ok(())
} 
