use crate::errors::CustomError;
use crate::events::MintAuthorityTransferStarted;
use crate::ControllerStore;
use crate::CONTROLLER_SEED;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TransferMintAuthorityParams {
    pub new_authority: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: TransferMintAuthorityParams)]
pub struct TransferMintAuthority<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [CONTROLLER_SEED],
        bump = controller_store.bump,
        has_one = owner @ CustomError::Unauthorized
    )]
    pub controller_store: Account<'info, ControllerStore>,
    #[account(
        address = controller_store.token_mint,
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn transfer_mint_authority(
    ctx: Context<TransferMintAuthority>,
    params: TransferMintAuthorityParams,
) -> Result<()> {
    let controller_store = &mut ctx.accounts.controller_store;
    require!(
        params.new_authority != Pubkey::default(),
        CustomError::InvalidPendingAuthority
    );

    // Set pending mint authority
    controller_store.pending_mint_authority = params.new_authority;

    emit!(MintAuthorityTransferStarted {
        token_mint: ctx.accounts.token_mint.key(),
        new_authority: params.new_authority,
    });

    Ok(())
}
