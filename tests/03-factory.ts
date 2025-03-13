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
import { assert } from "chai";
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

describe("factory", () => {
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

  // Initialize test accounts and PDAs
  const admin = Keypair.generate();
  const merchant = Keypair.generate();
  const custodian = Keypair.generate();
  const customer = Keypair.generate();
  const payer = provider.wallet.publicKey;
  let tokenMint: PublicKey;
  let controllerStore: PublicKey;
  let controllerTokenAccount: PublicKey;
  let controllerStoreBump: number;
  let factoryStore: PublicKey;
  let factoryStoreBump: number;
  let membersStore: PublicKey;
  let membersStoreBump: number;
  let merchantInfo: PublicKey;
  let merchantInfoBump: number;
  let custodianBtcAddress: PublicKey;
  let custodianBtcAddressBump: number;
  let merchantBtcAddress: PublicKey;
  let merchantBtcAddressBump: number;
  let requestAccount: PublicKey;
  let requestAccountBump: number;
  let merchantTokenAccount: PublicKey;

  // Test data
  const btcAddress = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
  const btcTxid =
    "50325250d21ddb5ef821862ea6a0ee0f9229331bf16402d7028f7858c93ecc2c";
  const amount = new BN(100000000); // 1 BTC (100,000,000 satoshis)
  let mintRequestNonce: number = 0;
  let burnRequestNonce: number = 0;

  const MERCHANT_INFO_SEED = "merchant_info";

  // Initialize test environment before all tests
  before(async () => {
    // Fund test accounts
    await provider.connection.requestAirdrop(admin.publicKey, 10000000000);
    await provider.connection.requestAirdrop(merchant.publicKey, 10000000000);
    await provider.connection.requestAirdrop(custodian.publicKey, 10000000000);
    await provider.connection.requestAirdrop(customer.publicKey, 10000000000);

    console.log("Setting up test environment...");
    console.log("Admin pubkey:", admin.publicKey.toString());
    console.log("Merchant pubkey:", merchant.publicKey.toString());
    console.log("Custodian pubkey:", custodian.publicKey.toString());
    console.log("Owner (provider) pubkey:", payer.toString());

    // 使用辅助模块初始化Members程序
    membersStore = await initializeMembers(membersProgram, wallet) as PublicKey;
    membersStoreBump = sharedState.membersStoreBump;
    console.log("Members store PDA:", membersStore.toString());

    // 使用辅助模块初始化Controller程序
    const result = await initializeController(controllerProgram, wallet);
    controllerStore = result.controllerStore as PublicKey;
    tokenMint = result.tokenMint as PublicKey;
    controllerStoreBump = sharedState.controllerStoreBump;
    controllerTokenAccount = sharedState.controllerTokenAccount as PublicKey;

    console.log("Controller store PDA:", controllerStore.toString());
    console.log("Controller token account:", controllerTokenAccount.toString());

    // Initialize Factory program using helper module
    factoryStore = await initializeFactory(
      factoryProgram,
      controllerProgram.programId,
      wallet
    ) as PublicKey;
    factoryStoreBump = sharedState.factoryStoreBump;
    console.log("Factory store PDA:", factoryStore.toString());

    console.log("members program id:", membersProgram.programId.toString());
    console.log("factory program id:", factoryProgram.programId.toString());
    console.log("controller program id:", controllerProgram.programId.toString());

    // Configure Controller with Members and Factory associations
    await configureController(
      controllerProgram,
      membersProgram.programId,
      factoryProgram.programId,
      wallet
    );

    // Set custodian
    await setCustodian(membersProgram, custodian.publicKey, wallet);
    console.log("Custodian set:", custodian.publicKey.toString());

    // Register merchant
    await addMerchant(membersProgram, merchant.publicKey, wallet);
    console.log("Merchant added:", merchant.publicKey.toString());

    // Calculate merchant's token account address
    merchantTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      merchant.publicKey
    );
    console.log("Merchant token account:", merchantTokenAccount.toString());
  });

  it("Set custodian BTC deposit address", async () => {
    // Ensure custodian has enough SOL
    const custodianBalance = await provider.connection.getBalance(
      custodian.publicKey
    );
    if (custodianBalance < 1000000000) {
      await provider.connection.requestAirdrop(custodian.publicKey, 1000000000);
      await new Promise((resolve) => setTimeout(resolve, 500)); // wait for confirmation
    }

    // Derive custodian BTC address account
    [custodianBtcAddress, custodianBtcAddressBump] =
      PublicKey.findProgramAddressSync(
        [Buffer.from("custodian_btc_address"), merchant.publicKey.toBuffer()],
        factoryProgram.programId
      );
    console.log("Custodian BTC address PDA:", custodianBtcAddress.toString());

    // Ensure custodian is the custodian set in members_store
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
    console.log("Merchant info PDA:", merchantInfo.toString());

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
        systemProgram: SystemProgram.programId,
      })
      .signers([custodian])
      .rpc();
    console.log("Custodian BTC deposit address set");

    // Verify address has been set
    const addressAccount =
      await factoryProgram.account.custodianBtcDepositAddress.fetch(
        custodianBtcAddress
      );
    assert.equal(addressAccount.btcAddress, btcAddress);
    assert.equal(
      addressAccount.merchant.toString(),
      merchant.publicKey.toString()
    );
  });

  it("Set merchant BTC deposit address", async () => {
    // Derive merchant BTC address account
    [merchantBtcAddress, merchantBtcAddressBump] =
      PublicKey.findProgramAddressSync(
        [Buffer.from("merchant_btc_address"), merchant.publicKey.toBuffer()],
        factoryProgram.programId
      );
    console.log("Merchant BTC address PDA:", merchantBtcAddress.toString());

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
    console.log("Merchant BTC deposit address set");

    // Verify address has been set
    const addressAccount =
      await factoryProgram.account.merchantBtcDepositAddress.fetch(
        merchantBtcAddress
      );
    assert.equal(addressAccount.btcAddress, btcAddress);
    assert.equal(
      addressAccount.merchant.toString(),
      merchant.publicKey.toString()
    );
  });

  it("Add mint request by merchant", async () => {
    // Get current counter value as nonce
    const factoryStoreData = await factoryProgram.account.factoryStore.fetch(
      factoryStore
    );
    mintRequestNonce = factoryStoreData.mintRequestCounter.toNumber();
    console.log("Current mint request counter:", mintRequestNonce);

    // Derive request account
    [requestAccount, requestAccountBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("mint_request"),
        new BN(mintRequestNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );
    console.log("Mint request account PDA:", requestAccount.toString());

    await factoryProgram.methods
      .addMintRequest({
        amount: amount,
        btcTxid: btcTxid,
        btcDepositAddress: btcAddress,
      })
      .accounts({
        payer: merchant.publicKey,
        factoryStore,
        requestAccount,
        controllerStore,
        merchantInfo,
        custodianBtcAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();
    console.log("Mint request added");

    // Verify request has been added
    const requestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );
    assert.equal(requestData.status.pending !== undefined, true);
    assert.equal(requestData.amount.toString(), amount.toString());
    assert.equal(requestData.btcTxid, btcTxid);
    assert.equal(requestData.btcDepositAddress, btcAddress);
    assert.equal(
      requestData.requester.toString(),
      merchant.publicKey.toString()
    );
  });

  it("Confirm mint request by custodian", async () => {
    // Recalculate request account PDA
    [requestAccount, requestAccountBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("mint_request"),
        new BN(mintRequestNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );
    console.log(
      "Mint request account for confirmation:",
      requestAccount.toString()
    );

    // Get request data and hash
    let mintRequestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );

    await factoryProgram.methods
      .confirmMintRequest({
        nonce: new BN(mintRequestNonce),
        requestHash: mintRequestData.hash,
      })
      .accounts({
        payer: custodian.publicKey,
        factoryStore,
        controllerStore,
        membersStore,
        requestAccount,
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
    console.log("Mint request confirmed");

    // Verify request status updated
    const requestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );
    assert.equal(requestData.status.approved !== undefined, true);

    // Verify tokens minted to merchant account
    const tokenBalance = await provider.connection.getTokenAccountBalance(
      merchantTokenAccount
    );
    console.log("Merchant token balance:", tokenBalance.value.amount);
    assert.equal(tokenBalance.value.amount, amount.toString());
  });

  it("Burn tokens by merchant", async () => {
    // Get current counter value as nonce
    const factoryStoreData = await factoryProgram.account.factoryStore.fetch(
      factoryStore
    );
    burnRequestNonce = factoryStoreData.burnRequestCounter.toNumber();
    console.log("Current burn request counter:", burnRequestNonce);

    // Derive burn request account
    [requestAccount, requestAccountBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("burn_request"),
        new BN(burnRequestNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );
    console.log("Burn request account PDA:", requestAccount.toString());

    // Controller token account
    const controllerTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      controllerStore,
      true
    );
    console.log("Controller token account:", controllerTokenAccount.toString());

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
    console.log("Burn request created and tokens burned");

    // Verify request status added
    const requestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );
    assert.equal(requestData.status.pending !== undefined, true);
    assert.equal(requestData.amount.toString(), amount.toString());

    // Verify merchant account balance decreased
    const tokenBalance = await provider.connection.getTokenAccountBalance(
      merchantTokenAccount
    );
    console.log(
      "Merchant token balance after burn:",
      tokenBalance.value.amount
    );
    assert.equal(tokenBalance.value.amount, "0");
  });

  it("Confirm burn request by custodian", async () => {
    // Get burn request data and hash
    let burnRequestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );

    await factoryProgram.methods
      .confirmBurnRequest({
        nonce: new BN(burnRequestNonce),
        btcTxid: btcTxid,
        requestHash: burnRequestData.hash,
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
    console.log("Burn request confirmed");

    // Verify request status updated
    const requestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );
    assert.equal(requestData.status.approved !== undefined, true);
    assert.equal(requestData.btcTxid, btcTxid);
  });

  it("Cancel mint request by merchant", async () => {
    // First create a new mint request
    const factoryStoreData = await factoryProgram.account.factoryStore.fetch(
      factoryStore
    );
    const newMintRequestNonce = factoryStoreData.mintRequestCounter.toNumber();
    console.log("New mint request nonce:", newMintRequestNonce);

    [requestAccount, requestAccountBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("mint_request"),
        new BN(newMintRequestNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );
    console.log("New mint request account:", requestAccount.toString());

    await factoryProgram.methods
      .addMintRequest({
        amount: amount,
        btcTxid: btcTxid,
        btcDepositAddress: btcAddress,
      })
      .accounts({
        payer: merchant.publicKey,
        factoryStore,
        requestAccount,
        controllerStore,
        merchantInfo,
        custodianBtcAddress,
        systemProgram: SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();
    console.log("New mint request added");

    // Now cancel this request
    let cancelRequestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );

    await factoryProgram.methods
      .cancelMintRequest({
        nonce: new BN(newMintRequestNonce),
        requestHash: cancelRequestData.hash,
      })
      .accounts({
        payer: merchant.publicKey,
        factoryStore,
        requestAccount,
      })
      .signers([merchant])
      .rpc();
    console.log("Mint request canceled");

    // Verify request status updated to canceled
    const requestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );
    assert.equal(requestData.status.canceled !== undefined, true);
  });

  it("Reject mint request by custodian", async () => {
    // First create a new mint request
    const factoryStoreData = await factoryProgram.account.factoryStore.fetch(
      factoryStore
    );
    const newMintRequestNonce = factoryStoreData.mintRequestCounter.toNumber();
    console.log("New mint request nonce for rejection:", newMintRequestNonce);

    [requestAccount, requestAccountBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("mint_request"),
        new BN(newMintRequestNonce).toArrayLike(Buffer, "le", 8),
      ],
      factoryProgram.programId
    );
    console.log(
      "New mint request account for rejection:",
      requestAccount.toString()
    );

    await factoryProgram.methods
      .addMintRequest({
        amount: amount,
        btcTxid: btcTxid,
        btcDepositAddress: btcAddress,
      })
      .accounts({
        payer: merchant.publicKey,
        factoryStore,
        requestAccount,
        controllerStore,
        merchantInfo,
        custodianBtcAddress,
        membersProgram: membersProgram.programId,
        systemProgram: SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();
    console.log("New mint request added for rejection");

    // Custodian rejects request
    let rejectRequestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );

    await factoryProgram.methods
      .rejectMintRequest({
        nonce: new BN(newMintRequestNonce),
        requestHash: rejectRequestData.hash,
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
    console.log("Mint request rejected");

    // Verify request status updated to rejected
    const requestData = await factoryProgram.account.requestAccount.fetch(
      requestAccount
    );
    assert.equal(requestData.status.rejected !== undefined, true);
  });
});
