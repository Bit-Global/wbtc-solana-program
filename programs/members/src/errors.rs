use anchor_lang::prelude::*;

#[error_code]
pub enum MembersError {
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Invalid address")]
    InvalidAddress,
    #[msg("Too many merchants")]
    TooManyMerchants,
    #[msg("Merchant already exists")]
    MerchantAlreadyExists,
    #[msg("Merchant not found")]
    MerchantNotFound,
    #[msg("Invalid token account address")]
    InvalidTokenAccount,
    #[msg("Token account not initialized")]
    UninitializedTokenAccount,
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    #[msg("Not an associated token account")]
    NotAssociatedTokenAccount,
    #[msg("Invalid owner address")]
    InvalidOwner,
    #[msg("No pending owner")]
    NoPendingOwner,
    #[msg("Invalid pending owner")]
    InvalidPendingOwner,
    #[msg("Invalid program ID")]
    InvalidProgramId,
    #[msg("Invalid operation")]
    InvalidOperation,
}
