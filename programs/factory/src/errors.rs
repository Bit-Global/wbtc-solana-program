use anchor_lang::prelude::*;

#[error_code]
pub enum FactoryError {
    #[msg("Unauthorized.")]
    Unauthorized,
    #[msg("Invalid BTC deposit address.")]
    InvalidBtcAddress,
    #[msg("Caller is not a merchant.")]
    NotMerchant,
    #[msg("Caller is not a custodian.")]
    NotCustodian,
    #[msg("Wrong BTC deposit address.")]
    WrongBtcDepositAddress,
    #[msg("Request hash cannot be zero.")]
    ZeroRequestHash,
    #[msg("No such request hash.")]
    InvalidRequestHash,
    #[msg("Nonce out of range.")]
    InvalidNonce,
    #[msg("Request is not pending.")]
    NotPendingRequest,
    #[msg("Mismatch request hash.")]
    MismatchRequestHash,
    #[msg("Cancel sender is not the request initiator.")]
    NotRequestInitiator,
    #[msg("Invalid factory address.")]
    InvalidFactoryAddress,
    #[msg("Invalid request type.")]
    InvalidRequestType,
    #[msg("Invalid members program.")]
    InvalidMembersProgram,
    #[msg("Invalid to address.")]
    InvalidToAddress,
    #[msg("Invalid token mint.")]
    InvalidTokenMint,
    #[msg("Invalid controller store.")]
    InvalidControllerStore,
    #[msg("Invalid token program.")]
    InvalidTokenProgram,
    #[msg("Invalid token account owner.")]
    InvalidTokenAccountOwner,
    #[msg("Invalid members store.")]
    InvalidMembersStore,
    #[msg("Invalid merchant.")]
    InvalidMerchant,
    #[msg("Invalid amount.")]
    InvalidAmount,
    #[msg("Invalid btc deposit address.")]
    InvalidBtcDepositAddress,
    #[msg("the address contains invalid (non-ascii) characters")]
    InvalidAddressCharacters,
    #[msg("the transaction contains invalid (non-ascii) characters")]
    InvalidTransactionCharacters,
    #[msg("the transaction length is invalid (not 64 characters)")]
    InvalidTransactionLength,
}
