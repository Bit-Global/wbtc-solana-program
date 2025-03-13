use anchor_lang::prelude::*;
use controller::cpi as controller_cpi;
use controller::cpi::accounts as controller_accounts;
use controller::program::Controller as ControllerProgram;
use crate::errors::FactoryError;
use crate::events::{Burned, BurnConfirmed};
use crate::state::{FactoryStore, RequestAccount, RequestStatus, RequestType, MerchantBtcDepositAddress};
use crate::FACTORY_SEED;
use crate::BURN_REQUEST_SEED;
use crate::MERCHANT_BTC_ADDRESS_SEED;
use members::MembersStore;
use members::MEMBERS_SEED;
use members::MERCHANT_INFO_SEED;
use members::MerchantInfo;
use controller::CONTROLLER_SEED;
use controller::ControllerStore;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use controller::instructions as controller_instructions;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BurnParams {
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(params: BurnParams)]
pub struct Burn<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [FACTORY_SEED],
        bump = factory_store.bump
    )]
    pub factory_store: Account<'info, FactoryStore>,
    #[account(
        init,
        payer = payer,
        space = 8 + RequestAccount::INIT_SPACE,
        seeds = [
            BURN_REQUEST_SEED, 
            &factory_store.burn_request_counter.to_le_bytes()
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
            MERCHANT_BTC_ADDRESS_SEED,
            payer.key().as_ref()
        ],
        bump = merchant_btc_address.bump,
        constraint = merchant_btc_address.merchant == payer.key() @ FactoryError::InvalidBtcAddress,
        constraint = !merchant_btc_address.btc_address.is_empty() @ FactoryError::InvalidBtcAddress
    )]
    pub merchant_btc_address: Account<'info, MerchantBtcDepositAddress>,
    #[account(
        mut,
        address = controller_store.token_mint,
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = payer,
        associated_token::token_program = token_program
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = controller_store,
        associated_token::token_program = token_program
    )]
    pub controller_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(address = controller::ID)]
    pub controller_program: Program<'info, ControllerProgram>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>, 
    pub system_program: Program<'info, System>,
    /// CHECK: Used for verifying CPI calls in the controller program
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: UncheckedAccount<'info>,
}

pub fn burn_handler(ctx: Context<Burn>, params: BurnParams) -> Result<()> {
    require!(params.amount > 0, FactoryError::InvalidAmount);

    let factory_store = &mut ctx.accounts.factory_store;
    let merchant_key = ctx.accounts.payer.key();

    // find the BTC address that the merchant wants to receive when burning
    let btc_deposit_address: String = ctx.accounts.merchant_btc_address.btc_address.clone();
    let request = &mut ctx.accounts.request_account;
    
    // initialize the request data
    request.request_type = RequestType::Burn;
    request.requester = merchant_key;
    request.amount = params.amount;
    request.btc_deposit_address = btc_deposit_address.clone();
    request.btc_txid = "".to_string(); // initialize as empty, filled by custodian when confirmed
    request.nonce = factory_store.burn_request_counter;
    request.timestamp = Clock::get()?.unix_timestamp;
    request.status = RequestStatus::Pending;
    request.bump = ctx.bumps.request_account;
    request.hash = request.calculate_hash();
    
    // update the counter
    factory_store.burn_request_counter += 1;

    // first transfer the tokens from merchant account to controller PDA account
    let transfer_cpi_accounts = TransferChecked {
        from: ctx.accounts.token_account.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.controller_token_account.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    
    let transfer_cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        transfer_cpi_accounts,
    );
    token_interface::transfer_checked(
        transfer_cpi_ctx,
        params.amount,
        ctx.accounts.token_mint.decimals,
    )?;

    // call the controller's burn method
    let cpi_program = ctx.accounts.controller_program.to_account_info();
    let cpi_accounts = controller_accounts::Burn {
        controller_store: ctx.accounts.controller_store.to_account_info(),
        token_mint: ctx.accounts.token_mint.to_account_info(),
        controller_token_account: ctx.accounts.controller_token_account.to_account_info(),
        instruction_sysvar: ctx.accounts.instruction_sysvar.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
    };
    
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    controller_cpi::burn(cpi_ctx, controller_instructions::burn::BurnParams { 
        amount: params.amount,
    })?;

    // emit the event
    emit!(Burned {
        nonce: request.nonce,
        requester: merchant_key,
        amount: params.amount,
        btc_deposit_address: btc_deposit_address.clone(),
        timestamp: request.timestamp,
        request_hash: request.hash,
    });
    Ok(())
}

// ---- Confirm Burn Request ----

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConfirmBurnParams {
    pub nonce: u64,
    pub btc_txid: String,
    pub request_hash: [u8; 32],
}   

#[derive(Accounts)]
#[instruction(params: ConfirmBurnParams)]
pub struct ConfirmBurnRequest<'info> {
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
            BURN_REQUEST_SEED, 
            &params.nonce.to_le_bytes()
        ],
        bump = request_account.bump,
        constraint = request_account.request_type == RequestType::Burn @ FactoryError::InvalidRequestType,
        constraint = request_account.nonce == params.nonce @ FactoryError::InvalidNonce,
        constraint = request_account.status == RequestStatus::Pending @ FactoryError::NotPendingRequest,
        constraint = request_account.hash == params.request_hash @ FactoryError::MismatchRequestHash,
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
    pub members_store: Account<'info, MembersStore>,
}

pub fn confirm_burn_request_handler(
    ctx: Context<ConfirmBurnRequest>,
    params: ConfirmBurnParams,
) -> Result<()> {
    let request = &mut ctx.accounts.request_account;

    // update the txid and status
    request.btc_txid = params.btc_txid.clone();
    request.status = RequestStatus::Approved;

    // emit the event
    emit!(BurnConfirmed {
        nonce: request.nonce,
        requester: request.requester,
        amount: request.amount,
        btc_deposit_address: request.btc_deposit_address.clone(),
        btc_txid: params.btc_txid.clone(),
        timestamp: request.timestamp,
        request_hash: request.hash,
    });
    Ok(())
} 
