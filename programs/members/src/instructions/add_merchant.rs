use crate::errors::MembersError;
use crate::events::MerchantAdd;
use crate::state::{MembersStore, MerchantInfo};
use crate::{MEMBERS_SEED, MERCHANT_INFO_SEED};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AddMerchantParams {
    pub merchant: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: AddMerchantParams)]
pub struct AddMerchant<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        has_one = owner @ MembersError::Unauthorized,
        seeds = [MEMBERS_SEED],
        bump = members_store.bump
    )]
    pub members_store: Account<'info, MembersStore>,
    // TODO: maker sure vec or pda
    // merchant info account
    #[account(
        init,
        payer = owner,
        space = 8 + MerchantInfo::INIT_SPACE,
        seeds = [MERCHANT_INFO_SEED, params.merchant.as_ref()],
        bump
    )]
    pub merchant_info: Account<'info, MerchantInfo>,
    pub system_program: Program<'info, System>,
}

pub fn add_merchant(ctx: Context<AddMerchant>, params: AddMerchantParams) -> Result<()> {
    require!(
        params.merchant != Pubkey::default(),
        MembersError::InvalidAddress
    );
    let members_store = &mut ctx.accounts.members_store;
    // initialize merchant info PDA
    let merchant_info = &mut ctx.accounts.merchant_info;
    merchant_info.merchant = params.merchant;
    merchant_info.bump = ctx.bumps.merchant_info;

    // update merchant count
    members_store.merchant_count += 1;

    emit!(MerchantAdd {
        merchant: params.merchant,
    });
    Ok(())
}
