use anchor_lang::prelude::*;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
use instructions::*;

declare_id!("6oJjbaBrFFzcy4h5Qt7pffLTyF737rv5W6uUbcdz98T6");

// Seeds constants
pub const FACTORY_SEED: &[u8] = b"factory";
pub const CUSTODIAN_BTC_ADDRESS_SEED: &[u8] = b"custodian_btc_address";
pub const MERCHANT_BTC_ADDRESS_SEED: &[u8] = b"merchant_btc_address";
pub const MINT_REQUEST_SEED: &[u8] = b"mint_request";
pub const BURN_REQUEST_SEED: &[u8] = b"burn_request";

#[program]
pub mod factory {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        initialize::handler(ctx, params)
    }

    /// Custodian sets the BTC deposit address for a merchant (mint process)
    pub fn set_custodian_btc_deposit_address(
        ctx: Context<SetCustodianBtcDepositAddress>,
        params: SetCustodianBtcDepositAddressParams,
    ) -> Result<()> {
        set_custodian_btc_deposit_address::handler(ctx, params)
    }

    /// Merchant sets their own BTC deposit address (burn process)
    pub fn set_merchant_btc_deposit_address(
        ctx: Context<SetMerchantBtcDepositAddress>,
        params: SetMerchantBtcDepositAddressParams,
    ) -> Result<()> {
        set_merchant_btc_deposit_address::handler(ctx, params)
    }

    /// Merchant adds a new mint request
    pub fn add_mint_request(ctx: Context<AddMintRequest>, params: MintParams) -> Result<()> {
        mint_requests::add_mint_request_handler(ctx, params)
    }

    /// Merchant cancels a mint request
    pub fn cancel_mint_request(
        ctx: Context<CancelMintRequest>,
        params: CancelMintParams,
    ) -> Result<()> {
        mint_requests::cancel_mint_request_handler(ctx, params)
    }

    /// Custodian confirms mint request and mints tokens to the specified user's token account (CPI call to controller::mint)
    pub fn confirm_mint_request(
        ctx: Context<ConfirmMintRequest>,
        params: ConfirmMintParams,
    ) -> Result<()> {
        mint_requests::confirm_mint_request_handler(ctx, params)
    }

    /// Custodian rejects mint request
    pub fn reject_mint_request(
        ctx: Context<RejectMintRequest>,
        params: RejectMintParams,
    ) -> Result<()> {
        mint_requests::reject_mint_request_handler(ctx, params)
    }

    /// Merchant initiates a burn request
    pub fn burn(ctx: Context<Burn>, params: BurnParams) -> Result<()> {
        burn::burn_handler(ctx, params)
    }

    /// Custodian confirms burn request, writing the final btcTxid
    pub fn confirm_burn_request(
        ctx: Context<ConfirmBurnRequest>,
        params: ConfirmBurnParams,
    ) -> Result<()> {
        burn::confirm_burn_request_handler(ctx, params)
    }
}
