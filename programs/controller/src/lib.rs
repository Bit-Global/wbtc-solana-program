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

declare_id!("7ezKPbUnvgQ5qbsfasdDE7KYAfNJuNQxpo3dL6YCqfb4");

// Seeds constants
pub const CONTROLLER_SEED: &[u8] = b"controller";
pub const FACTORY_SEED: &[u8] = b"factory";

#[program]
pub mod controller {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::initialize(ctx)
    }

    pub fn set_members(ctx: Context<SetMembers>, params: SetMembersParams) -> Result<()> {
        instructions::set_members::set_members(ctx, params)
    }

    pub fn set_factory(ctx: Context<SetFactory>, params: SetFactoryParams) -> Result<()> {
        instructions::set_factory::set_factory(ctx, params)
    }

    pub fn mint(ctx: Context<_Mint>, params: MintParams) -> Result<()> {
        instructions::mint::mint(ctx, params)
    }

    pub fn burn(ctx: Context<Burn>, params: BurnParams) -> Result<()> {
        instructions::burn::burn(ctx, params)
    }

    pub fn transfer_ownership(
        ctx: Context<SetOwnerContext>,
        params: TransferOwnershipParams,
    ) -> Result<()> {
        instructions::transfer_ownership::transfer_ownership(ctx, params)
    }

    pub fn claim_ownership(ctx: Context<ClaimOwnershipContext>) -> Result<()> {
        instructions::claim_ownership::claim_ownership(ctx)
    }

    pub fn transfer_mint_authority(
        ctx: Context<TransferMintAuthority>,
        params: TransferMintAuthorityParams,
    ) -> Result<()> {
        instructions::transfer_mint_authority::transfer_mint_authority(ctx, params)
    }

    pub fn claim_mint_authority(ctx: Context<ClaimMintAuthority>) -> Result<()> {
        instructions::claim_mint_authority::claim_mint_authority(ctx)
    }
}
