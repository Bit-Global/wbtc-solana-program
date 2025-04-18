use crate::errors::CustomError;
use crate::events::ControllerInitialized;
use crate::ControllerStore;
use crate::CONTROLLER_SEED;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
#[derive(Accounts)]
#[instruction()]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + ControllerStore::INIT_SPACE,
        seeds = [CONTROLLER_SEED],
        bump
    )]
    pub controller_store: Account<'info, ControllerStore>,
    #[account(mint::token_program = token_program)]
    pub token_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let controller_store = &mut ctx.accounts.controller_store;
    let token_mint = ctx.accounts.token_mint.key();

    require!(
        token_mint != Pubkey::default(),
        CustomError::InvalidTokenAddress
    );

    controller_store.token_mint = token_mint;
    controller_store.owner = ctx.accounts.payer.key();
    controller_store.pending_owner = Pubkey::default();
    controller_store.pending_mint_authority = Pubkey::default();
    controller_store.bump = ctx.bumps.controller_store;

    emit!(ControllerInitialized {
        token_mint: controller_store.token_mint,
        owner: controller_store.owner
    });

    Ok(())
}
