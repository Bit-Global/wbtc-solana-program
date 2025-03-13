// Module declarations
pub mod burn;
pub mod claim_mint_authority;
pub mod claim_ownership;
pub mod initialize;
pub mod mint;
pub mod set_factory;
pub mod set_members;
pub mod transfer_mint_authority;
pub mod transfer_ownership;

// Re-export all instructions
pub use burn::*;
pub use claim_mint_authority::*;
pub use claim_ownership::*;
pub use initialize::*;
pub use mint::*;
pub use set_factory::*;
pub use set_members::*;
pub use transfer_mint_authority::*;
pub use transfer_ownership::*;
