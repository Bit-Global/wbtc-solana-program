use crate::errors::FactoryError;
use crate::events::MerchantBtcDepositAddressSet;
use crate::state::{FactoryStore, MerchantBtcDepositAddress};
use crate::FACTORY_SEED;
use crate::MERCHANT_BTC_ADDRESS_SEED;
use anchor_lang::prelude::*;
use controller::CONTROLLER_SEED;
use members::MerchantInfo;
use members::MERCHANT_INFO_SEED;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SetMerchantBtcDepositAddressParams {
    pub btc_deposit_address: String,
}

#[derive(Accounts)]
#[instruction(params: SetMerchantBtcDepositAddressParams)]
pub struct SetMerchantBtcDepositAddress<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [FACTORY_SEED],
        bump = factory_store.bump
    )]
    pub factory_store: Account<'info, FactoryStore>,
    #[account(
        seeds = [CONTROLLER_SEED],
        bump = controller_store.bump,
        seeds::program = factory_store.controller,
    )]
    pub controller_store: Account<'info, controller::ControllerStore>,
    #[account(
        seeds = [MERCHANT_INFO_SEED, payer.key().as_ref()],
        bump = merchant_info.bump,
        seeds::program = controller_store.members
    )]
    pub merchant_info: Account<'info, MerchantInfo>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + MerchantBtcDepositAddress::INIT_SPACE,
        seeds = [
            MERCHANT_BTC_ADDRESS_SEED,
            payer.key().as_ref()
        ],
        bump
    )]
    pub merchant_btc_address: Account<'info, MerchantBtcDepositAddress>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SetMerchantBtcDepositAddress>,
    params: SetMerchantBtcDepositAddressParams,
) -> Result<()> {
    require!(
        !params.btc_deposit_address.is_empty(),
        FactoryError::InvalidBtcDepositAddress
    );

    let merchant_key = ctx.accounts.payer.key();

    let merchant_btc_address = &mut ctx.accounts.merchant_btc_address;
    merchant_btc_address.merchant = merchant_key;
    merchant_btc_address.btc_address = params.btc_deposit_address.clone();
    merchant_btc_address.bump = ctx.bumps.merchant_btc_address;

    emit!(MerchantBtcDepositAddressSet {
        merchant: merchant_key,
        btc_deposit_address: params.btc_deposit_address.clone(),
    });
    Ok(())
}
