use anchor_lang::prelude::*;

// Submodules
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

// Re-exports
pub use errors::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("B5joQaTLCcc3mwiWh63qBVvEsz7VsagMann3mFGQq9Sb");

// Seeds constants
pub const MEMBERS_SEED: &[u8] = b"members";
pub const MERCHANT_INFO_SEED: &[u8] = b"merchant_info";

#[program]
pub mod members {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::initialize(ctx)
    }

    pub fn set_custodian(ctx: Context<SetCustodian>, params: SetCustodianParams) -> Result<()> {
        instructions::set_custodian::set_custodian(ctx, params)
    }

    pub fn add_merchant(ctx: Context<AddMerchant>, params: AddMerchantParams) -> Result<()> {
        instructions::add_merchant::add_merchant(ctx, params)
    }

    pub fn remove_merchant(
        ctx: Context<RemoveMerchant>,
        params: RemoveMerchantParams,
    ) -> Result<()> {
        instructions::remove_merchant::remove_merchant(ctx, params)
    }

    pub fn transfer_ownership(
        ctx: Context<TransferOwnership>,
        params: TransferOwnershipParams,
    ) -> Result<()> {
        instructions::transfer_ownership::transfer_ownership(ctx, params)
    }

    pub fn claim_ownership(ctx: Context<ClaimOwnership>) -> Result<()> {
        instructions::claim_ownership::claim_ownership(ctx)
    }
}
