use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Invalid token address")]
    InvalidTokenAddress,
    #[msg("Invalid members address")]
    InvalidMembersAddress,
    #[msg("Invalid factory address")]
    InvalidFactoryAddress,
    #[msg("Invalid to address")]
    InvalidToAddress,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid owner")]
    InvalidOwner,
    #[msg("No pending owner")]
    NoPendingOwner,
    #[msg("Invalid pending owner")]
    InvalidPendingOwner,
    #[msg("Member check failed")]
    MemberCheckFailed,
    #[msg("Invalid factory program")]
    InvalidFactoryProgram,
    #[msg("Already initialized")]
    AlreadyInitialized,
    #[msg("Not initialized")]
    NotInitialized,
    #[msg("Token account mismatch")]
    TokenAccountMismatch,
    #[msg("Token mint mismatch")]
    TokenMintMismatch,
    #[msg("Invalid token account address")]
    InvalidTokenAccountAddress,
    #[msg("Invalid program ID for PDA ownership")]
    InvalidProgramId,
}
