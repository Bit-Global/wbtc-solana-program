import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert, expect } from "chai";
import { BN } from "bn.js";

// Import program IDs and types
import { Controller } from "../target/types/controller";
import { Members } from "../target/types/members";
import { Factory } from "../target/types/factory";
import {
  initializeMembers,
  initializeController,
  initializeFactory,
  configureController,
  setCustodian,
  addMerchant,
  sharedState,
} from "../helpers/test-setup";

// Utility function to catch and return errors
const catchError = async <T>(promise: Promise<T>): Promise<Error | null> => {
  try {
    await promise;
    return null;
  } catch (error: unknown) {
    return error as Error;
  }
};

describe("factory_error_tests", () => {
  // Configure test environment
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Key pairs and account variable declarations
  const wallet = provider.wallet as anchor.Wallet;
  const walletKP = Keypair.fromSecretKey(wallet.payer.secretKey);
  // Get program references
  const controllerProgram = anchor.workspace.Controller as Program<Controller>;
  const membersProgram = anchor.workspace.Members as Program<Members>;
  const factoryProgram = anchor.workspace.Factory as Program<Factory>;

  const MERCHANT_INFO_SEED = "merchant_info";

  // Initialize test accounts and PDAs
  let admin: Keypair;
  let merchant: Keypair;
  let custodian: Keypair;
  let nonMerchant: Keypair;
  let nonCustodian: Keypair;
  let membersStore: PublicKey;
  let merchantInfo: PublicKey;
  let controllerStore: PublicKey;
  let factoryStore: PublicKey;
  let mintAccount: PublicKey;
  let custodianBtcAddress: PublicKey, custodianBtcAddressBump: number;
  let merchantBtcAddress: PublicKey, merchantBtcAddressBump: number;
  let requestAccount: PublicKey, requestAccountBump: number;
  let tokenMint: PublicKey;
  let controllerTokenAccount: PublicKey;
  let controllerStoreBump: number;
  let factoryStoreBump: number;
  let membersStoreBump: number;
  let merchantInfoBump: number;
  let payer = provider.wallet.publicKey;
  let merchantTokenAccount: PublicKey;
  let nonMerchantTokenAccount: PublicKey;

  // Test data
  const btcAddress = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
  const wrongBtcAddress = "bc1qwrongaddress123456789abcdefghijklmnopqrstu";
  const btcTxid =
    "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16";
  const amount = new BN(100000000); // 1 BTC = 100,000,000 satoshis
  const zeroAmount = new BN(0);
  let mintRequestNonce = 0;
  let burnRequestNonce = 0;

  // Initialize test environment before all tests
  before(async () => {
    console.log("Setting up test environment...");
    // Creating test accounts
    admin = Keypair.generate();
    merchant = Keypair.generate();
    custodian = Keypair.generate();
    nonMerchant = Keypair.generate();
    nonCustodian = Keypair.generate();

    console.log("Admin pubkey:", admin.publicKey.toString());
    console.log("Merchant pubkey:", merchant.publicKey.toString());
    console.log("Custodian pubkey:", custodian.publicKey.toString());
    console.log("Non-merchant pubkey:", nonMerchant.publicKey.toString());
    console.log("Non-custodian pubkey:", nonCustodian.publicKey.toString());
    console.log("Owner (provider) pubkey:", wallet.publicKey.toString());

    // Request funds for test accounts
    await Promise.all([
      provider.connection.requestAirdrop(admin.publicKey, 10_000_000_000),
      provider.connection.requestAirdrop(merchant.publicKey, 10_000_000_000),
      provider.connection.requestAirdrop(custodian.publicKey, 10_000_000_000),
      provider.connection.requestAirdrop(nonMerchant.publicKey, 10_000_000_000),
      provider.connection.requestAirdrop(
        nonCustodian.publicKey,
        10_000_000_000
      ),
    ]);

    // Wait for transactions to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 使用辅助模块初始化 Members 程序
    const msResult = await initializeMembers(membersProgram, wallet);
    membersStore = msResult as PublicKey;
    membersStoreBump = sharedState.membersStoreBump;
    console.log("Members store PDA:", membersStore.toString());

    // 使用辅助模块初始化 Controller 程序
    const result = await initializeController(controllerProgram, wallet);
    controllerStore = result.controllerStore as PublicKey;
    tokenMint = result.tokenMint as PublicKey;
    controllerStoreBump = sharedState.controllerStoreBump;
    controllerTokenAccount = sharedState.controllerTokenAccount as PublicKey;

    console.log("Controller store PDA:", controllerStore.toString());
    console.log("Controller token account:", controllerTokenAccount.toString());

    // 使用辅助模块初始化 Factory 程序
    const fsResult = await initializeFactory(
      factoryProgram,
      controllerProgram.programId,
      wallet
    );
    factoryStore = fsResult as PublicKey;
    factoryStoreBump = sharedState.factoryStoreBump;
    console.log("Factory store PDA:", factoryStore.toString());

    // 配置Controller的Members和Factory关联
    await configureController(
      controllerProgram,
      membersProgram.programId,
      factoryProgram.programId,
      wallet
    );

    // Calculate token account addresses
    merchantTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      merchant.publicKey
    );
    nonMerchantTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      nonMerchant.publicKey
    );

    console.log("merchantTokenAccount:", merchantTokenAccount.toString());
    console.log("nonMerchantTokenAccount:", nonMerchantTokenAccount.toString());

    // 设置角色
    // Add admin as merchant
    await addMerchant(membersProgram, admin.publicKey, wallet);
    console.log("Admin added as merchant");

    // Add merchant as merchant
    await addMerchant(membersProgram, merchant.publicKey, wallet);
    console.log("Merchant added");

    // Set custodian
    await setCustodian(membersProgram, custodian.publicKey, wallet);
    console.log("Custodian set");

    // Verify roles
    const membersStoreData = await membersProgram.account.membersStore.fetch(
      membersStore
    );
    console.log("Custodian set to:", membersStoreData.custodian.toString());
    console.log("Merchant count:", membersStoreData.merchantCount);
  });

  // Mint error test cases
  it("Attempt to mint without setting BTC deposit address", async () => {
    const factoryStoreData = await factoryProgram.account.factoryStore.fetch(
      factoryStore
    );
    mintRequestNonce = factoryStoreData.mintRequestCounter.toNumber();

    [requestAccount, requestAccountBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("mint_request"),
        new BN(mintRequestNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    // Derive merchant info account
    [merchantInfo, merchantInfoBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.publicKey.toBuffer()],
      membersProgram.programId
    );

    try {
      await factoryProgram.methods
        .addMintRequest({
          amount: amount,
          btcTxid: btcTxid,
          btcDepositAddress: btcAddress,
        })
        .accounts({
          payer: merchant.publicKey,
          factoryStore: factoryStore,
          requestAccount: requestAccount,
          controllerStore: controllerStore,
          merchantInfo: merchantInfo,
          custodianBtcAddress: custodianBtcAddress,
          systemProgram: SystemProgram.programId,
        })
        .signers([merchant])
        .rpc();
      assert.fail("Should throw an error");
    } catch (error) {
      console.log("Error message:", error.toString());
      assert.match(
        error.toString(),
        /custodian_btc_address/,
        "Should return an error about missing BTC deposit address"
      );
    }
  });

  // Set up custodian BTC address for subsequent tests
  it("Set custodian BTC address to prepare for subsequent tests", async () => {
    // Ensure custodian has enough SOL
    const custodianBalance = await provider.connection.getBalance(
      custodian.publicKey
    );
    if (custodianBalance < 1000000000) {
      await provider.connection.requestAirdrop(custodian.publicKey, 1000000000);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for confirmation
    }

    // Derive custodian BTC address account
    [custodianBtcAddress, custodianBtcAddressBump] =
      PublicKey.findProgramAddressSync(
        [Buffer.from("custodian_btc_address"), merchant.publicKey.toBuffer()],
        factoryProgram.programId
      );
    console.log("Custodian BTC address PDA:", custodianBtcAddress.toString());

    // Ensure custodian is the one set in members_store
    const membersStoreData = await membersProgram.account.membersStore.fetch(
      membersStore
    );
    console.log("Current custodian:", membersStoreData.custodian.toString());
    console.log("Using custodian:", custodian.publicKey.toString());

    // Derive merchant info account
    [merchantInfo, merchantInfoBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.publicKey.toBuffer()],
      membersProgram.programId
    );

    // Set custodian BTC deposit address
    await factoryProgram.methods
      .setCustodianBtcDepositAddress({
        merchant: merchant.publicKey,
        btcDepositAddress: btcAddress,
      })
      .accounts({
        payer: custodian.publicKey,
        factoryStore: factoryStore,
        controllerStore: controllerStore,
        membersStore: membersStore,
        merchantInfo: merchantInfo,
        custodianBtcAddress: custodianBtcAddress,
        membersProgram: membersProgram.programId,
        systemProgram: SystemProgram.programId,
      })
      .signers([custodian])
      .rpc();

    console.log("Setting BTC address:", btcAddress);
  });

  it("Attempt to mint to non-merchant address", async () => {
    const btcAddress = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
    console.log("Setting BTC address:", btcAddress);
    // Derive a BTC address PDA for non-merchant
    const [nonMerchantBtcAddress, nonMerchantBtcAddressBump] =
      PublicKey.findProgramAddressSync(
        [
          Buffer.from("custodian_btc_address"),
          nonMerchant.publicKey.toBuffer(),
        ],
        factoryProgram.programId
      );

    // Derive merchant info account
    [merchantInfo, merchantInfoBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), nonMerchant.publicKey.toBuffer()],
      membersProgram.programId
    );

    // First initialize the non-merchant's BTC address account
    const error = await catchError(
      factoryProgram.methods
        .setCustodianBtcDepositAddress({
          merchant: nonMerchant.publicKey,
          btcDepositAddress: btcAddress,
        })
        .accounts({
          payer: custodian.publicKey,
          factoryStore,
          controllerStore,
          membersStore,
          merchantInfo,
          nonMerchantBtcAddress,
          systemProgram: SystemProgram.programId,
        })
        .signers([custodian])
        .rpc()
    );
    // Check error type
    assert.notEqual(error, null, "Should have thrown an error but didn't");
    console.log("Set BTC address error:", error.message);
    assert.match(error.message, /AccountNotInitialized/);

    // Get current nonce
    const factoryStoreData = await factoryProgram.account.factoryStore.fetch(
      factoryStore
    );
    mintRequestNonce = factoryStoreData.mintRequestCounter.toNumber();

    [requestAccount, requestAccountBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("mint_request"),
        new BN(mintRequestNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    try {
      await factoryProgram.methods
        .addMintRequest({
          amount: amount,
          btcTxid: btcTxid,
          btcDepositAddress: btcAddress,
        })
        .accounts({
          payer: nonMerchant.publicKey,
          factoryStore: factoryStore,
          requestAccount: requestAccount,
          controllerStore: controllerStore,
          merchantInfo: merchantInfo,
          custodianBtcAddress: nonMerchantBtcAddress,
          systemProgram: SystemProgram.programId,
        })
        .signers([nonMerchant])
        .rpc();
      assert.fail("Should throw an error");
    } catch (error) {
      console.log("Mint request error:", error.toString());
      // custodian_btc_address not initialized
      assert.match(error.toString(), /AccountNotInitialized/);
    }
  });

  it("Merchant attempts to cancel a mint request not initiated by them", async () => {
    // First, admin initiates a mint request
    const factoryStoreData = await factoryProgram.account.factoryStore.fetch(
      factoryStore
    );
    const currentNonce = factoryStoreData.mintRequestCounter.toNumber();

    console.log("Current nonce:", currentNonce);

    [requestAccount, requestAccountBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("mint_request"),
        new BN(currentNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    // Derive a custodianBtcAddress for admin
    const [adminCustodianBtcAddress, adminCustodianBtcAddressBump] =
      PublicKey.findProgramAddressSync(
        [Buffer.from("custodian_btc_address"), admin.publicKey.toBuffer()],
        factoryProgram.programId
      );

    // Derive merchant info account
    [merchantInfo, merchantInfoBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), admin.publicKey.toBuffer()],
      membersProgram.programId
    );

    // Set admin's BTC deposit address
    await factoryProgram.methods
      .setCustodianBtcDepositAddress({
        merchant: admin.publicKey,
        btcDepositAddress: btcAddress,
      })
      .accounts({
        payer: custodian.publicKey,
        factoryStore: factoryStore,
        controllerStore: controllerStore,
        membersStore: membersStore,
        merchantInfo: merchantInfo,
        custodianBtcAddress: adminCustodianBtcAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([custodian])
      .rpc();

    // Admin initiates mint request
    await factoryProgram.methods
      .addMintRequest({
        amount: amount,
        btcTxid: btcTxid,
        btcDepositAddress: btcAddress,
      })
      .accounts({
        payer: admin.publicKey,
        factoryStore: factoryStore,
        requestAccount: requestAccount,
        membersStore: membersStore,
        merchantInfo: merchantInfo,
        controllerStore: controllerStore,
        custodianBtcAddress: adminCustodianBtcAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    // Try to cancel the request using another merchant
    try {
      const requestData = await factoryProgram.account.requestAccount.fetch(
        requestAccount
      );

      await factoryProgram.methods
        .cancelMintRequest({
          nonce: new BN(currentNonce),
          requestHash: requestData.hash,
        })
        .accounts({
          payer: merchant.publicKey, // Not the request initiator
          factoryStore: factoryStore,
          requestAccount: requestAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([merchant])
        .rpc();
      assert.fail("Should throw an error");
    } catch (error) {
      console.log("Error message:", error.toString());
      assert.match(
        error.toString(),
        /Cancel sender is not the request initiator/,
        "Should return an error about request owner mismatch"
      );
    }
  });

  it("After adding a normal mint request, non-custodian attempts to confirm it", async () => {
    // First add a normal mint request
    const factoryStoreData = await factoryProgram.account.factoryStore.fetch(
      factoryStore
    );
    mintRequestNonce = factoryStoreData.mintRequestCounter.toNumber();

    [requestAccount, requestAccountBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("mint_request"),
        new BN(mintRequestNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    // Derive merchant info account
    [merchantInfo, merchantInfoBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.publicKey.toBuffer()],
      membersProgram.programId
    );

    await factoryProgram.methods
      .addMintRequest({
        amount: amount,
        btcTxid: btcTxid,
        btcDepositAddress: btcAddress,
      })
      .accounts({
        payer: merchant.publicKey,
        factoryStore: factoryStore,
        requestAccount: requestAccount,
        merchantInfo: merchantInfo,
        controllerStore: controllerStore,
        custodianBtcAddress: custodianBtcAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();

    const requestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );

    // Non-custodian attempts to confirm
    const error = await catchError(
      factoryProgram.methods
        .confirmMintRequest({
          nonce: new BN(mintRequestNonce),
          requestHash: requestData.hash,
        })
        .accounts({
          payer: nonCustodian.publicKey,
          factoryStore,
          requestAccount,
          controllerStore,
          membersStore,
          tokenMint,
          toAddress: merchant.publicKey,
          tokenAccount: merchantTokenAccount,
          controllerProgram: controllerProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .signers([nonCustodian])
        .rpc()
    );

    // Check error type
    assert.notEqual(error, null, "Should have thrown an error but didn't");
    console.log("Error message:", error.message);
    assert.match(error.message, /NotCustodian/);
  });

  it("Attempt to confirm a request that is not in Pending status", async () => {
    const requestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );

    // First confirm the request using custodian
    await factoryProgram.methods
      .confirmMintRequest({
        nonce: new BN(mintRequestNonce),
        requestHash: requestData.hash,
      })
      .accounts({
        payer: custodian.publicKey,
        factoryStore,
        requestAccount,
        controllerStore,
        membersStore,
        tokenMint,
        toAddress: merchant.publicKey,
        tokenAccount: merchantTokenAccount,
        controllerProgram: controllerProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .signers([custodian])
      .rpc();

    // Try to confirm an already confirmed request
    const error = await catchError(
      factoryProgram.methods
        .confirmMintRequest({
          nonce: new BN(mintRequestNonce),
          requestHash: requestData.hash,
        })
        .accounts({
          payer: custodian.publicKey,
          factoryStore,
          requestAccount,
          controllerStore,
          membersStore,
          tokenMint,
          toAddress: merchant.publicKey,
          tokenAccount: merchantTokenAccount,
          controllerProgram: controllerProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .signers([custodian])
        .rpc()
    );

    // Check error type
    assert.notEqual(error, null, "Should have thrown an error but didn't");
    console.log("Error message:", error.message);
    assert.match(error.message, /NotPendingRequest/);
  });

  it("Attempt to confirm a non-existent request nonce", async () => {
    const requestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );

    const invalidNonce = 999999; // Non-existent nonce
    [requestAccount, requestAccountBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("mint_request"),
        new BN(invalidNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    const error = await catchError(
      factoryProgram.methods
        .confirmMintRequest({
          nonce: new BN(invalidNonce),
          requestHash: requestData.hash,
        })
        .accounts({
          payer: custodian.publicKey,
          factoryStore,
          requestAccount,
          controllerStore,
          membersStore,
          tokenMint,
          toAddress: merchant.publicKey,
          tokenAccount: merchantTokenAccount,
          controllerProgram: controllerProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .signers([custodian])
        .rpc()
    );

    // Check error type
    assert.notEqual(error, null, "Should have thrown an error but didn't");
    console.log("Error message:", error.message);
    // request account not initialized
    assert.match(error.message, /AccountNotInitialized/);
  });

  // Burn error test cases
  it("Attempt to burn without setting merchant BTC receiving address", async () => {
    // Create a valid merchantBtcAddress PDA, but don't set BTC address
    [merchantBtcAddress, merchantBtcAddressBump] =
      PublicKey.findProgramAddressSync(
        [Buffer.from("merchant_btc_address"), merchant.publicKey.toBuffer()],
        factoryProgram.programId
      );

    // Try to burn but address is empty
    const factoryStoreData = await factoryProgram.account.factoryStore.fetch(
      factoryStore
    );
    burnRequestNonce = factoryStoreData.burnRequestCounter.toNumber();

    [requestAccount, requestAccountBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("burn_request"),
        new BN(burnRequestNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    const error = await catchError(
      factoryProgram.methods
        .burn({
          amount: amount,
        })
        .accounts({
          payer: merchant.publicKey,
          factoryStore,
          requestAccount,
          controllerStore,
          membersStore,
          merchantBtcAddress,
          tokenMint,
          tokenAccount: merchantTokenAccount,
          controllerTokenAccount,
          controllerProgram: controllerProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .signers([merchant])
        .rpc()
    );

    // Check error type
    assert.notEqual(error, null, "Should have thrown an error but didn't");
    console.log("Error message:", error.message);
    assert.match(error.message, /AccountNotInitialized/);
  });

  it("Set merchant BTC address and perform burn test", async () => {
    // Set merchant BTC address
    [merchantBtcAddress, merchantBtcAddressBump] =
      PublicKey.findProgramAddressSync(
        [Buffer.from("merchant_btc_address"), merchant.publicKey.toBuffer()],
        factoryProgram.programId
      );

    // Derive merchant info account
    [merchantInfo, merchantInfoBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.publicKey.toBuffer()],
      membersProgram.programId
    );

    await factoryProgram.methods
      .setMerchantBtcDepositAddress({
        btcDepositAddress: btcAddress,
      })
      .accounts({
        payer: merchant.publicKey,
        factoryStore,
        controllerStore,
        merchantInfo,
        merchantBtcAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();

    // Execute burn
    const factoryStoreData = await factoryProgram.account.factoryStore.fetch(
      factoryStore
    );
    burnRequestNonce = factoryStoreData.burnRequestCounter.toNumber();

    [requestAccount, requestAccountBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("burn_request"),
        new BN(burnRequestNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    // Normal burn should succeed
    await factoryProgram.methods
      .burn({
        amount: amount,
      })
      .accounts({
        payer: merchant.publicKey,
        factoryStore,
        requestAccount,
        controllerStore,
        merchantInfo,
        merchantBtcAddress,
        tokenMint,
        tokenAccount: merchantTokenAccount,
        controllerTokenAccount,
        controllerProgram: controllerProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .signers([merchant])
      .rpc();

    // Verify burn request has been created
    const requestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );
    assert.equal(requestData.status.pending !== undefined, true);
  });

  it("Non-custodian attempts to confirm burn request", async () => {
    const requestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );

    const error = await catchError(
      factoryProgram.methods
        .confirmBurnRequest({
          nonce: new BN(burnRequestNonce),
          btcTxid: btcTxid,
          requestHash: requestData.hash,
        })
        .accounts({
          payer: nonCustodian.publicKey, // Non-custodian
          factoryStore,
          requestAccount,
          controllerStore,
          membersStore,
        })
        .signers([nonCustodian])
        .rpc()
    );

    // Check error type
    assert.notEqual(error, null, "Should have thrown an error but didn't");
    console.log("Error message:", error.message);
    assert.match(error.message, /NotCustodian/);
  });

  it("After confirming a burn request normally, attempt to confirm again", async () => {
    const requestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );

    // First confirm the burn request
    await factoryProgram.methods
      .confirmBurnRequest({
        nonce: new BN(burnRequestNonce),
        btcTxid: btcTxid,
        requestHash: requestData.hash,
      })
      .accounts({
        payer: custodian.publicKey,
        factoryStore,
        requestAccount,
        controllerStore,
        membersStore,
      })
      .signers([custodian])
      .rpc();

    // Try to confirm an already confirmed request
    const error = await catchError(
      factoryProgram.methods
        .confirmBurnRequest({
          nonce: new BN(burnRequestNonce),
          btcTxid: btcTxid,
          requestHash: requestData.hash,
        })
        .accounts({
          payer: custodian.publicKey,
          factoryStore,
          requestAccount,
          controllerStore,
          membersStore,
        })
        .signers([custodian])
        .rpc()
    );

    // Check error type
    assert.notEqual(error, null, "Should have thrown an error but didn't");
    console.log("Error message:", error.message);
    assert.match(error.message, /NotPendingRequest/);
  });

  it("Attempt to burn when merchant WBTC balance is insufficient", async () => {
    // Create a new burn request (but merchantTokenAccount has no tokens left)
    const factoryStoreData = await factoryProgram.account.factoryStore.fetch(
      factoryStore
    );
    const newBurnRequestNonce = factoryStoreData.burnRequestCounter.toNumber();

    [requestAccount, requestAccountBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("burn_request"),
        new BN(newBurnRequestNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    // Derive merchant info account
    [merchantInfo, merchantInfoBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.publicKey.toBuffer()],
      membersProgram.programId
    );

    const error = await catchError(
      factoryProgram.methods
        .burn({
          amount: amount,
        })
        .accounts({
          payer: merchant.publicKey,
          factoryStore,
          requestAccount,
          controllerStore,
          merchantInfo,
          merchantBtcAddress,
          tokenMint,
          tokenAccount: merchantTokenAccount,
          controllerTokenAccount,
          controllerProgram: controllerProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .signers([merchant])
        .rpc()
    );

    // Check error type
    assert.notEqual(error, null, "Should have thrown an error but didn't");
    console.log("Error message:", error.message);
    assert.match(error.message, /insufficient funds/i);
  });

  it("Attempt to burn 0 amount of WBTC", async () => {
    // Try to burn 0 amount
    const factoryStoreData = await factoryProgram.account.factoryStore.fetch(
      factoryStore
    );
    const newBurnRequestNonce = factoryStoreData.burnRequestCounter.toNumber();

    [requestAccount, requestAccountBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("burn_request"),
        new BN(newBurnRequestNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );

    // Derive merchant info account
    [merchantInfo, merchantInfoBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(MERCHANT_INFO_SEED), merchant.publicKey.toBuffer()],
      membersProgram.programId
    );

    const error = await catchError(
      factoryProgram.methods
        .burn({
          amount: zeroAmount,
        })
        .accounts({
          payer: merchant.publicKey,
          factoryStore,
          requestAccount,
          controllerStore,
          merchantInfo,
          merchantBtcAddress,
          tokenMint,
          tokenAccount: merchantTokenAccount,
          controllerTokenAccount,
          controllerProgram: controllerProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .signers([merchant])
        .rpc()
    );

    // Check error type
    assert.notEqual(error, null, "Should have thrown an error but didn't");
    console.log("Error message:", error.message);
    // SPL Token Program typically rejects transfers of 0 amount
    assert.match(error.message, /InvalidAmount/i);
  });
});
