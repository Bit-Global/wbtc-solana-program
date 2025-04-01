use anchor_lang::prelude::*;
use controller::program::Controller as ControllerProgram;
use controller::cpi as controller_cpi;
use crate::errors::FactoryError;
use crate::events::{MintRequestAdd, MintRequestCancel, MintConfirmed, MintRejected};
use crate::state::{FactoryStore, RequestAccount, RequestStatus, RequestType, CustodianBtcDepositAddress};
use crate::CUSTODIAN_BTC_ADDRESS_SEED;
use crate::FACTORY_SEED;
use crate::MINT_REQUEST_SEED;
use members::MEMBERS_SEED;
use members::MERCHANT_INFO_SEED;
use members::MerchantInfo;
use controller::CONTROLLER_SEED;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{ Mint, TokenAccount, TokenInterface},
};
use controller::ControllerStore;
use controller::instructions as controller_instructions;

// ---- Add Mint Request ----
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintParams {
    pub amount: u64,
    pub btc_txid: String,
    pub btc_deposit_address: String,
}

#[derive(Accounts)]
#[instruction(params: MintParams)]
pub struct AddMintRequest<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [FACTORY_SEED],
        bump = factory_store.bump
    )]
    pub factory_store: Account<'info, FactoryStore>,
    // New request account PDA
    #[account(
        init,
        payer = payer,
        space = 8 + RequestAccount::INIT_SPACE,
        seeds = [
            MINT_REQUEST_SEED, 
            &factory_store.mint_request_counter.to_le_bytes()
        ],
        bump
    )]
    pub request_account: Account<'info, RequestAccount>,
    #[account(
        seeds = [CONTROLLER_SEED],
        bump = controller_store.bump,
        seeds::program = factory_store.controller,
    )]
    pub controller_store: Account<'info, ControllerStore>,
    #[account(
        seeds = [MERCHANT_INFO_SEED, payer.key().as_ref()],
        bump = merchant_info.bump,
        seeds::program = controller_store.members
    )]
    pub merchant_info: Account<'info, MerchantInfo>,
    #[account(
        seeds = [
            CUSTODIAN_BTC_ADDRESS_SEED,
            payer.key().as_ref()
        ],
        bump = custodian_btc_address.bump,
        constraint = custodian_btc_address.merchant == payer.key() @ FactoryError::InvalidMerchant,
        constraint = custodian_btc_address.btc_address == params.btc_deposit_address @ FactoryError::WrongBtcDepositAddress
    )]
    pub custodian_btc_address: Account<'info, CustodianBtcDepositAddress>,
    pub system_program: Program<'info, System>,
}

pub fn add_mint_request_handler(
    ctx: Context<AddMintRequest>,
    params: MintParams,
) -> Result<()> {
    let factory_store = &mut ctx.accounts.factory_store;
    let merchant_key = ctx.accounts.payer.key();

    require!(!params.btc_deposit_address.is_empty(), FactoryError::InvalidBtcAddress);

    let request = &mut ctx.accounts.request_account;
    
    // Set request account content
    request.request_type = RequestType::Mint;
    request.requester = merchant_key;
    request.amount = params.amount;
    request.btc_deposit_address = params.btc_deposit_address.clone();
    request.btc_txid = params.btc_txid.clone();
    request.nonce = factory_store.mint_request_counter;
    request.timestamp = Clock::get()?.unix_timestamp;
    request.status = RequestStatus::Pending;
    request.bump = ctx.bumps.request_account;
    request.hash = request.calculate_hash();

    // Update factory counter
    factory_store.mint_request_counter += 1;

    // Emit event
    emit!(MintRequestAdd {
        nonce: request.nonce,
        requester: merchant_key,
        amount: params.amount,
        btc_deposit_address: params.btc_deposit_address.clone(),
        btc_txid: params.btc_txid.clone(),
        timestamp: request.timestamp,
        request_hash: request.hash,
    });
    Ok(())
}

// ---- Cancel Mint Request ----

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CancelMintParams {
    pub nonce: u64,
    pub request_hash: [u8; 32],
}

#[derive(Accounts)]
#[instruction(params: CancelMintParams)]
pub struct CancelMintRequest<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [FACTORY_SEED],
        bump = factory_store.bump
    )]
    pub factory_store: Account<'info, FactoryStore>,
    #[account(
        mut,
        seeds = [
            MINT_REQUEST_SEED, 
            &params.nonce.to_le_bytes()
        ],
        bump = request_account.bump,
        constraint = request_account.request_type == RequestType::Mint @ FactoryError::InvalidRequestType,
        constraint = request_account.nonce == params.nonce @ FactoryError::InvalidNonce,
        constraint = request_account.status == RequestStatus::Pending @ FactoryError::NotPendingRequest,
        constraint = request_account.requester == payer.key() @ FactoryError::NotRequestInitiator,
        constraint = request_account.hash == params.request_hash @ FactoryError::MismatchRequestHash,
    )]
    pub request_account: Account<'info, RequestAccount>,
}

pub fn cancel_mint_request_handler(ctx: Context<CancelMintRequest>, params: CancelMintParams) -> Result<()> {
    let request = &mut ctx.accounts.request_account;
    // Update status
    request.status = RequestStatus::Canceled;
    // Emit event
    emit!(MintRequestCancel {
        nonce: request.nonce,
        requester: ctx.accounts.payer.key(),
        request_hash: request.hash,
    });
    Ok(())
}

// ---- Confirm Mint Request ----
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConfirmMintParams {
    pub nonce: u64,
    pub request_hash: [u8; 32],
}

#[derive(Accounts)]
#[instruction(params: ConfirmMintParams)]
pub struct ConfirmMintRequest<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [FACTORY_SEED],
        bump = factory_store.bump
    )]
    pub factory_store: Account<'info, FactoryStore>,
    #[account(
        seeds = [CONTROLLER_SEED],
        bump = controller_store.bump,
        seeds::program = factory_store.controller,
    )]
    pub controller_store: Account<'info, ControllerStore>,
    #[account(
        seeds = [MEMBERS_SEED],
        bump = members_store.bump,
        seeds::program = controller_store.members,
        constraint = members_store.is_custodian(&payer.key()) @ FactoryError::NotCustodian
    )]
    pub members_store: Account<'info, members::MembersStore>,
    #[account(
        mut,
        seeds = [
            MINT_REQUEST_SEED, 
            &params.nonce.to_le_bytes()
        ],
        bump = request_account.bump,
        constraint = request_account.request_type == RequestType::Mint @ FactoryError::InvalidRequestType,
        constraint = request_account.nonce == params.nonce @ FactoryError::InvalidNonce,
        constraint = request_account.status == RequestStatus::Pending @ FactoryError::NotPendingRequest,
        constraint = request_account.hash == params.request_hash @ FactoryError::MismatchRequestHash,
    )]
    pub request_account: Account<'info, RequestAccount>,
    #[account(
        mut,
        address = controller_store.token_mint,
        mint::token_program = token_program,
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,
    /// CHECK: Verify that to_address matches request_account.requester
    #[account(
        constraint = to_address.key() == request_account.requester @ FactoryError::InvalidToAddress
    )]
    pub to_address: AccountInfo<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = to_address,
        associated_token::token_program = token_program
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(address = controller::ID)]
    pub controller_program: Program<'info, ControllerProgram>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>, 
    pub system_program: Program<'info, System>,
}

pub fn confirm_mint_request_handler(ctx: Context<ConfirmMintRequest>, params: ConfirmMintParams) -> Result<()> {
    let request = &mut ctx.accounts.request_account;
    
    // call the mint method of controller
    let cpi_program = ctx.accounts.controller_program.to_account_info();
    let cpi_accounts = controller_cpi::accounts::_Mint {
        factory_store: ctx.accounts.factory_store.to_account_info(),
        controller_store: ctx.accounts.controller_store.to_account_info(),
        token_mint: ctx.accounts.token_mint.to_account_info(),
        token_account: ctx.accounts.token_account.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
    };

    // prepare PDA signature
    let factory_seeds = &[FACTORY_SEED, &[ctx.accounts.factory_store.bump]];
    let signer_seeds = &[&factory_seeds[..]];
    
    // use with_signer to pass PDA signature
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
    
    controller_cpi::mint(cpi_ctx, controller_instructions::mint::MintParams {
        to: ctx.accounts.to_address.key(),
        amount: request.amount,
    })?;

    // Modify the request status
    request.status = RequestStatus::Approved;

    // Emit event
    emit!(MintConfirmed {
        nonce: request.nonce,
        requester: request.requester,
        amount: request.amount,
        btc_deposit_address: request.btc_deposit_address.clone(),
        btc_txid: request.btc_txid.clone(),
        timestamp: request.timestamp,
        request_hash: request.hash,
    });
    Ok(())
}

// ---- Reject Mint Request ----

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RejectMintParams {
    pub nonce: u64,
    pub request_hash: [u8; 32],
}

#[derive(Accounts)]
#[instruction(params: RejectMintParams)]
pub struct RejectMintRequest<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [FACTORY_SEED],
        bump = factory_store.bump
    )]
    pub factory_store: Account<'info, FactoryStore>,
    #[account(
        mut,
        seeds = [
            MINT_REQUEST_SEED, 
            &params.nonce.to_le_bytes()
        ],
        bump = request_account.bump,
        constraint = request_account.request_type == RequestType::Mint @ FactoryError::InvalidRequestType,
        constraint = request_account.nonce == params.nonce @ FactoryError::InvalidNonce,
        constraint = request_account.status == RequestStatus::Pending @ FactoryError::NotPendingRequest,
        constraint = request_account.hash == params.request_hash @ FactoryError::MismatchRequestHash
    )]
    pub request_account: Account<'info, RequestAccount>,
    #[account(
        seeds = [CONTROLLER_SEED],
        bump = controller_store.bump,
        seeds::program = factory_store.controller,
    )]
    pub controller_store: Account<'info, ControllerStore>,
    #[account(
        seeds = [MEMBERS_SEED],
        bump = members_store.bump,
        seeds::program = controller_store.members,
        constraint = members_store.is_custodian(&payer.key()) @ FactoryError::NotCustodian
    )]
    pub members_store: Account<'info, members::MembersStore>,
}

pub fn reject_mint_request_handler(ctx: Context<RejectMintRequest>, params: RejectMintParams) -> Result<()> {
    let request = &mut ctx.accounts.request_account;
    
    // Update the request status
    request.status = RequestStatus::Rejected;

    // Send the event
    emit!(MintRejected {
        nonce: request.nonce,
        requester: request.requester,
        amount: request.amount,
        btc_deposit_address: request.btc_deposit_address.clone(),
        btc_txid: request.btc_txid.clone(),
        timestamp: request.timestamp,
        request_hash: request.hash,
    });
    Ok(())
} 
