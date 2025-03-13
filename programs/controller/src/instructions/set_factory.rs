use crate::errors::CustomError;
use crate::events::FactorySet;
use crate::ControllerStore;
use crate::CONTROLLER_SEED;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SetFactoryParams {
    pub factory: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: SetFactoryParams)]
pub struct SetFactory<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [CONTROLLER_SEED],
        bump = controller_store.bump,
        has_one = owner @ CustomError::Unauthorized
    )]
    pub controller_store: Account<'info, ControllerStore>,
}

pub fn set_factory(ctx: Context<SetFactory>, params: SetFactoryParams) -> Result<()> {
    let controller_store = &mut ctx.accounts.controller_store;
    require!(
        params.factory != Pubkey::default(),
        CustomError::InvalidFactoryAddress
    );
    controller_store.factory = params.factory;
    emit!(FactorySet {
        factory: params.factory
    });
    Ok(())
}
