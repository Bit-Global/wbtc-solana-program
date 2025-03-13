use anchor_lang::prelude::*;

#[event]
pub struct CustodianSet {
    pub custodian: Pubkey,
}

#[event]
pub struct MerchantAdd {
    pub merchant: Pubkey,
}

#[event]
pub struct MerchantRemove {
    pub merchant: Pubkey,
}

#[event]
pub struct MembersInitialized {
    pub owner: Pubkey,
    pub bump: u8,
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
pub struct MerchantsResized {
    pub new_capacity: u16,
}
