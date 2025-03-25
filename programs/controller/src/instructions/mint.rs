use crate::errors::CustomError;
use crate::ControllerStore;
use crate::CONTROLLER_SEED;
use crate::FACTORY_SEED;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface},
};
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintParams {
    pub to: Pubkey,
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(params: MintParams)]
pub struct _Mint<'info> {
    #[account(
        seeds = [FACTORY_SEED],
        bump,
        seeds::program = controller_store.factory
    )]
    pub factory_store: Signer<'info>,
    #[account(
        seeds = [CONTROLLER_SEED],
        bump = controller_store.bump
    )]
    pub controller_store: Account<'info, ControllerStore>,
    #[account(
        mut,
        address = controller_store.token_mint,
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = params.to,
        associated_token::token_program = token_program
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn mint(ctx: Context<_Mint>, params: MintParams) -> Result<()> {
    let controller_store = &mut ctx.accounts.controller_store;
    require!(
        params.to != Pubkey::default(),
        CustomError::InvalidToAddress
    );

    // Get the seeds for PDA signing
    let controller_seeds = &[CONTROLLER_SEED, &[controller_store.bump]];
    let signer_seeds = &[&controller_seeds[..]];

    // Create a CPI context with signer seeds
    let cpi_accounts = token_interface::MintTo {
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.token_account.to_account_info(),
        authority: controller_store.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

    // Execute mint operation
    token_interface::mint_to(cpi_ctx, params.amount)?;

    Ok(())
}
