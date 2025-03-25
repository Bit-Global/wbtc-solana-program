use crate::errors::CustomError;
use crate::events::MintAuthorityTransferred;
use crate::ControllerStore;
use crate::CONTROLLER_SEED;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenInterface};

#[derive(Accounts)]
#[instruction()]
pub struct ClaimMintAuthority<'info> {
    #[account(
        mut,
        seeds = [CONTROLLER_SEED],
        bump = controller_store.bump,
        constraint = controller_store.pending_mint_authority == pending_authority.key() @ CustomError::InvalidPendingAuthority
    )]
    pub controller_store: Account<'info, ControllerStore>,
    pub pending_authority: Signer<'info>,
    #[account(
        mut,
        address = controller_store.token_mint,
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn claim_mint_authority(ctx: Context<ClaimMintAuthority>) -> Result<()> {
    let controller_store = &mut ctx.accounts.controller_store;
    let pending_authority = controller_store.pending_mint_authority;

    // Get the seeds for PDA signing
    let controller_seeds = &[CONTROLLER_SEED, &[controller_store.bump]];
    let signer_seeds = &[&controller_seeds[..]];

    // Create a CPI context with signer seeds
    let cpi_accounts = token_interface::SetAuthority {
        account_or_mint: ctx.accounts.token_mint.to_account_info(),
        current_authority: controller_store.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

    // Execute set authority operation
    token_interface::set_authority(
        cpi_ctx,
        token_interface::spl_token_2022::instruction::AuthorityType::MintTokens,
        Some(pending_authority),
    )?;

    // Reset pending mint authority
    controller_store.pending_mint_authority = Pubkey::default();

    emit!(MintAuthorityTransferred {
        token_mint: ctx.accounts.token_mint.key(),
        new_authority: pending_authority,
    });

    Ok(())
}
