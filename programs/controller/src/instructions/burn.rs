use crate::errors::CustomError;
use crate::ControllerStore;
use crate::CONTROLLER_SEED;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BurnParams {
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(params: BurnParams)]
pub struct Burn<'info> {
    #[account(
        seeds = [CONTROLLER_SEED],
        bump = controller_store.bump
    )]
    pub controller_store: Account<'info, ControllerStore>,
    #[account(
        mut,
        address = controller_store.token_mint,
        mint::token_program = token_program,
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = controller_store,
        associated_token::token_program = token_program
    )]
    pub controller_token_account: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: used to verify the source of CPI calls
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn burn(ctx: Context<Burn>, params: BurnParams) -> Result<()> {
    let caller_program_id =
        anchor_lang::solana_program::sysvar::instructions::get_instruction_relative(
            0,
            &ctx.accounts.instruction_sysvar.to_account_info(),
        )?
        .program_id;
    require!(
        caller_program_id == ctx.accounts.controller_store.factory,
        CustomError::Unauthorized
    );

    let controller_store = &mut ctx.accounts.controller_store;
    // Get the seeds for PDA signing
    let controller_seeds = &[CONTROLLER_SEED, &[controller_store.bump]];
    let signer_seeds = &[&controller_seeds[..]];

    // Create a CPI context with signer seeds
    let cpi_accounts = token_interface::Burn {
        mint: ctx.accounts.token_mint.to_account_info(),
        from: ctx.accounts.controller_token_account.to_account_info(),
        authority: controller_store.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

    // Execute burn operation
    token_interface::burn(cpi_ctx, params.amount)?;

    Ok(())
}
