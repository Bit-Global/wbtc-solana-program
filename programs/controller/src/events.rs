use anchor_lang::prelude::*;

#[event]
pub struct MembersSet {
    pub members: Pubkey,
}

#[event]
pub struct FactorySet {
    pub factory: Pubkey,
}

#[event]
pub struct OwnershipTransferStarted {
    pub previous_owner: Pubkey,
    pub new_owner: Pubkey,
}

#[event]
pub struct OwnershipTransferred {
    pub previous_owner: Pubkey,
    pub new_owner: Pubkey,
}

#[event]
pub struct ControllerInitialized {
    pub token_mint: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct MintAuthorityTransferStarted {
    pub token_mint: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct MintAuthorityTransferred {
    pub token_mint: Pubkey,
    pub new_authority: Pubkey,
}
