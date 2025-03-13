use anchor_lang::prelude::*;
use crate::state::FactoryStore;
use crate::FACTORY_SEED;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeParams {
    pub controller: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init, 
        payer = payer, 
        space = 8 + FactoryStore::INIT_SPACE,
        seeds = [FACTORY_SEED],
        bump
    )]
    pub factory_store: Account<'info, FactoryStore>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    let factory_store = &mut ctx.accounts.factory_store;
    factory_store.mint_request_counter = 0;
    factory_store.burn_request_counter = 0;
    factory_store.controller = params.controller;
    factory_store.bump = ctx.bumps.factory_store;
    Ok(())
} 