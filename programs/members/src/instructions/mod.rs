// Module declarations
pub mod add_merchant;
pub mod claim_ownership;
pub mod initialize;
pub mod remove_merchant;
pub mod set_custodian;
pub mod transfer_ownership;

// Re-export all instructions
pub use add_merchant::*;
pub use claim_ownership::*;
pub use initialize::*;
pub use remove_merchant::*;
pub use set_custodian::*;
pub use transfer_ownership::*;
