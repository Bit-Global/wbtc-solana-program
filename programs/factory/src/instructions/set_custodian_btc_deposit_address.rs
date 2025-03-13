use crate::errors::FactoryError;
use crate::events::CustodianBtcDepositAddressSet;
use crate::state::{CustodianBtcDepositAddress, FactoryStore};
use crate::CUSTODIAN_BTC_ADDRESS_SEED;
use crate::FACTORY_SEED;
use anchor_lang::prelude::*;
use controller::CONTROLLER_SEED;
use members::MEMBERS_SEED;
use members::MERCHANT_INFO_SEED;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SetCustodianBtcDepositAddressParams {
    pub merchant: Pubkey,
    pub btc_deposit_address: String,
}

#[derive(Accounts)]
#[instruction(params: SetCustodianBtcDepositAddressParams)]
pub struct SetCustodianBtcDepositAddress<'info> {
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
        seeds = [MEMBERS_SEED],
        bump = members_store.bump,
        seeds::program = controller_store.members,
        constraint = members_store.is_custodian(&payer.key()) @ FactoryError::NotCustodian,
    )]
    pub members_store: Account<'info, members::MembersStore>,
    #[account(
        seeds = [MERCHANT_INFO_SEED, params.merchant.as_ref()],
        bump = merchant_info.bump,
        seeds::program = controller_store.members
    )]
    pub merchant_info: Account<'info, members::MerchantInfo>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + CustodianBtcDepositAddress::INIT_SPACE,
        seeds = [
            CUSTODIAN_BTC_ADDRESS_SEED,
            params.merchant.as_ref()
        ],
        bump
    )]
    pub custodian_btc_address: Account<'info, CustodianBtcDepositAddress>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SetCustodianBtcDepositAddress>,
    params: SetCustodianBtcDepositAddressParams,
) -> Result<()> {
    require!(
        !params.btc_deposit_address.is_empty(),
        FactoryError::InvalidBtcDepositAddress
    );

    // update PDA account data
    let custodian_btc_address = &mut ctx.accounts.custodian_btc_address;
    custodian_btc_address.merchant = params.merchant;
    custodian_btc_address.btc_address = params.btc_deposit_address.clone();
    custodian_btc_address.bump = ctx.bumps.custodian_btc_address;

    // emit event
    emit!(CustodianBtcDepositAddressSet {
        merchant: params.merchant,
        btc_deposit_address: params.btc_deposit_address.clone(),
    });

    Ok(())
}
