use anchor_lang::prelude::*;
use crate::errors::MembersError;
use crate::events::MerchantRemove;
use crate::state::{MembersStore, MerchantInfo};
use crate::{MEMBERS_SEED, MERCHANT_INFO_SEED};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RemoveMerchantParams {
    pub merchant: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: RemoveMerchantParams)]
pub struct RemoveMerchant<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut, 
        has_one = owner @ MembersError::Unauthorized,
        seeds = [MEMBERS_SEED],
        bump = members_store.bump
    )]
    pub members_store: Account<'info, MembersStore>,
    #[account(
        mut,
        close = owner,
        seeds = [MERCHANT_INFO_SEED, params.merchant.as_ref()],
        bump = merchant_info.bump
    )]
    pub merchant_info: Account<'info, MerchantInfo>,
    pub system_program: Program<'info, System>,
}

pub fn remove_merchant(
    ctx: Context<RemoveMerchant>,
    params: RemoveMerchantParams,
) -> Result<()> {
    // update counter
    let members_store = &mut ctx.accounts.members_store;
    members_store.merchant_count = members_store.merchant_count.saturating_sub(1);
    // merchant info account will be closed and refunded automatically
    emit!(MerchantRemove {
        merchant: params.merchant,
    });
    Ok(())
} 
