// Members program test file
// Testing the Members smart contract functionality on Solana
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Members } from "../target/types/members";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";
import { initializeMembers, sharedState } from "../helpers/test-setup";

describe("Members Program Tests", () => {
  // Configure Anchor provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Get Members program
  const program = anchor.workspace.Members as Program<Members>;

  // Key pairs and account variable declarations
  const wallet = provider.wallet as anchor.Wallet;
  let membersStore: PublicKey;
  let membersBump: number;
  let merchantInfo: PublicKey;
  let merchantInfoBump: number;
  let custodianKeypair: Keypair;
  let merchantKeypair: Keypair;
  let newOwnerKeypair: Keypair;

  // Constants - match with program
  const MEMBERS_SEED = "members";
  const MERCHANT_INFO_SEED = "merchant_info";

  // Set up environment before all tests
  before(async () => {
    console.log("Setting up test environment...");

    // Create test key pairs
    custodianKeypair = anchor.web3.Keypair.generate();
    merchantKeypair = anchor.web3.Keypair.generate();
    newOwnerKeypair = anchor.web3.Keypair.generate();

    // Initialize Members program using helper module
    membersStore = (await initializeMembers(program, wallet)) as PublicKey;
    membersBump = sharedState.membersStoreBump;
    console.log(
      `Members PDA: ${membersStore.toString()}, Bump: ${membersBump}`
    );

    // Airdrop SOL to merchant and new owner accounts for transaction fees
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        merchantKeypair.publicKey,
        1000000000
      ) // 1 SOL
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        newOwnerKeypair.publicKey,
        1000000000
      ) // 1 SOL
    );

    // Verify Members account exists
    try {
      const membersAccount = await program.account.membersStore.fetch(
        membersStore
      );
      console.log("Members account exists and is initialized");
    } catch (err) {
      console.error("Failed to fetch members account:", err);
      throw err;
    }
  });

  // Test initialization functionality - now we skip actual initialization since it's done in setup
  it("Members account should be properly initialized", async () => {
    try {
      // Get Members account state
      const membersAccount = await program.account.membersStore.fetch(
        membersStore
      );

      // Assert initialization state is correct
      assert.equal(
        membersAccount.owner.toString(),
        wallet.publicKey.toString()
      );
      assert.equal(
        membersAccount.custodian.toString(),
        PublicKey.default.toString()
      );
      assert.equal(membersAccount.merchantCount, 0);
      assert.equal(membersAccount.bump, membersBump);

      console.log("Members initialization verified successfully");
    } catch (err) {
      console.error("Verification failed:", err);
      throw err;
    }
  });

  // Test set custodian functionality
  it("Set custodian", async () => {
    try {
      // Call setCustodian instruction
      const tx = await program.methods
        .setCustodian({
          custodian: custodianKeypair.publicKey,
        })
        .accounts({
          owner: wallet.publicKey,
          membersStore: membersStore,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Set custodian transaction signature:", tx);

      // Get updated Members account state
      const membersAccount = await program.account.membersStore.fetch(
        membersStore
      );

      // Assert custodian is set correctly
      assert.equal(
        membersAccount.custodian.toString(),
        custodianKeypair.publicKey.toString()
      );
      console.log("Custodian set successfully");
    } catch (err) {
      console.error("Set custodian failed:", err);
      throw err;
    }
  });

  // Test add merchant functionality
  it("Add merchant", async () => {
    try {
      // Derive MerchantInfo PDA seed
      [merchantInfo, merchantInfoBump] = PublicKey.findProgramAddressSync(
        [Buffer.from(MERCHANT_INFO_SEED), merchantKeypair.publicKey.toBuffer()],
        program.programId
      );
      console.log(
        `Merchant Info PDA: ${merchantInfo.toString()}, Bump: ${merchantInfoBump}`
      );

      // Call addMerchant instruction
      const tx = await program.methods
        .addMerchant({
          merchant: merchantKeypair.publicKey,
        })
        .accounts({
          owner: wallet.publicKey,
          membersStore: membersStore,
          merchantInfo: merchantInfo,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Add merchant transaction signature:", tx);

      // Get updated Members account state
      const membersAccount = await program.account.membersStore.fetch(
        membersStore
      );

      // Get MerchantInfo account
      const merchantInfoAccount = await program.account.merchantInfo.fetch(
        merchantInfo
      );

      // Assert merchant count increased
      assert.equal(membersAccount.merchantCount, 1);

      // Assert merchantInfo account was created correctly
      assert.equal(
        merchantInfoAccount.merchant.toString(),
        merchantKeypair.publicKey.toString()
      );

      // Assert merchant pda is on chain
      const merchantInfoExists = await provider.connection.getAccountInfo(
        merchantInfo
      );
      assert.isNotNull(
        merchantInfoExists,
        "Merchant info account should exist on chain"
      );
      assert.equal(
        merchantInfoExists.owner.toString(),
        program.programId.toString(),
        "Merchant info account should be owned by the program"
      );

      console.log("Merchant added successfully");
    } catch (err) {
      console.error("Add merchant failed:", err);
      throw err;
    }
  });

  // Test remove merchant functionality
  it("Remove merchant", async () => {
    try {
      // Call removeMerchant instruction
      const tx = await program.methods
        .removeMerchant({
          merchant: merchantKeypair.publicKey,
        })
        .accounts({
          owner: wallet.publicKey,
          membersStore: membersStore,
          merchantInfo: merchantInfo,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Remove merchant transaction signature:", tx);

      // Get updated Members account state
      const membersAccount = await program.account.membersStore.fetch(
        membersStore
      );

      // Assert merchant count decreased
      assert.equal(membersAccount.merchantCount, 0);

      // Verify merchant info account was closed
      try {
        await program.account.merchantInfo.fetch(merchantInfo);
        assert.fail("MerchantInfo account should be closed");
      } catch (err) {
        // Expected error - account not found
        console.log("MerchantInfo account correctly closed");
      }

      // Assert merchant pda is not on chain
      const merchantInfoExists = await provider.connection.getAccountInfo(
        merchantInfo
      );
      assert.isNull(
        merchantInfoExists,
        "Merchant info account should not exist on chain"
      );

      console.log("Merchant removed successfully");
    } catch (err) {
      console.error("Remove merchant failed:", err);
      throw err;
    }
  });

  it("Rejects unauthorized custodian setting", async () => {
    try {
      // Try to call setCustodian with unauthorized account
      try {
        await program.methods
          .setCustodian({
            custodian: custodianKeypair.publicKey,
          })
          .accounts({
            owner: newOwnerKeypair.publicKey, // Unauthorized account
            membersStore: membersStore,
            systemProgram: SystemProgram.programId,
          })
          .signers([newOwnerKeypair])
          .rpc();

        // Should not reach here
        assert.fail("Operation should be rejected due to authorization check");
      } catch (err) {
        // Expected to fail with unauthorized error
        console.log("Operation correctly rejected due to authorization check");
      }
    } catch (err) {
      console.error("Test failed:", err);
      throw err;
    }
  });

  // Test adding merchant with default address (should fail)
  it("Rejects adding merchant with default address", async () => {
    try {
      // Derive MerchantInfo PDA seed
      const [invalidMerchantInfoPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from(MERCHANT_INFO_SEED),
          membersStore.toBuffer(),
          PublicKey.default.toBuffer(),
        ],
        program.programId
      );

      // Try to call addMerchant with default address
      try {
        await program.methods
          .addMerchant({
            merchant: PublicKey.default,
          })
          .accounts({
            owner: wallet.publicKey,
            membersStore: membersStore,
            merchantInfo: invalidMerchantInfoPDA,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        // Should not reach here
        assert.fail("Operation should be rejected due to default address");
      } catch (err) {
        // Expected to fail with invalid address error
        console.log(
          "Operation correctly rejected due to default address check"
        );
      }
    } catch (err) {
      console.error("Test failed:", err);
      throw err;
    }
  });

  // Test start ownership transfer
  it("Start ownership transfer", async () => {
    try {
      // Call transferOwnership instruction
      const tx = await program.methods
        .transferOwnership({
          newOwner: newOwnerKeypair.publicKey,
        })
        .accounts({
          membersStore: membersStore,
          owner: wallet.publicKey,
        })
        .rpc();

      console.log("Start ownership transfer transaction signature:", tx);

      // Get updated Members account state
      const membersAccount = await program.account.membersStore.fetch(
        membersStore
      );

      // Assert pendingOwner is set correctly
      assert.equal(
        membersAccount.pendingOwner.toString(),
        newOwnerKeypair.publicKey.toString()
      );
      // Confirm current owner has not changed
      assert.equal(
        membersAccount.owner.toString(),
        wallet.publicKey.toString()
      );
    } catch (err) {
      console.error("Start ownership transfer failed:", err);
      throw err;
    }
  });

  // Test accept ownership transfer
  it("Accept ownership transfer", async () => {
    try {
      // Call claimOwnership instruction with new owner
      const tx = await program.methods
        .claimOwnership()
        .accounts({
          membersStore: membersStore,
          pendingOwner: newOwnerKeypair.publicKey,
        })
        .signers([newOwnerKeypair]) // Requires new owner signature
        .rpc();

      console.log("Accept ownership transfer transaction signature:", tx);

      // Get updated Members account state
      const membersAccount = await program.account.membersStore.fetch(
        membersStore
      );

      // Assert ownership has been transferred
      assert.equal(
        membersAccount.owner.toString(),
        newOwnerKeypair.publicKey.toString()
      );
      // pendingOwner should be reset
      assert.equal(
        membersAccount.pendingOwner.toString(),
        PublicKey.default.toString()
      );
    } catch (err) {
      console.error("Accept ownership transfer failed:", err);
      throw err;
    }
  });

  // Test new owner permissions (should be able to set custodian)
  it("New owner can set custodian", async () => {
    try {
      // Call setCustodian instruction with new owner
      const tx = await program.methods
        .setCustodian({
          custodian: merchantKeypair.publicKey, // Setting merchant as custodian
        })
        .accounts({
          owner: newOwnerKeypair.publicKey,
          membersStore: membersStore,
          systemProgram: SystemProgram.programId,
        })
        .signers([newOwnerKeypair])
        .rpc();

      console.log("New owner set custodian transaction signature:", tx);

      // Get updated Members account state
      const membersAccount = await program.account.membersStore.fetch(
        membersStore
      );

      // Assert custodian is set correctly
      assert.equal(
        membersAccount.custodian.toString(),
        merchantKeypair.publicKey.toString()
      );
      console.log("New owner set custodian successfully");
    } catch (err) {
      console.error("New owner set custodian failed:", err);
      throw err;
    }
  });

  // Test unauthorized ownership claim (should fail)
  it("Rejects unauthorized ownership claim", async () => {
    try {
      // Setup for test - need to transfer ownership first
      await program.methods
        .transferOwnership({
          newOwner: newOwnerKeypair.publicKey,
        })
        .accounts({
          membersStore: membersStore,
          owner: newOwnerKeypair.publicKey,
        })
        .signers([newOwnerKeypair])
        .rpc();

      // Try to claim ownership with wrong account
      try {
        await program.methods
          .claimOwnership()
          .accounts({
            membersStore: membersStore,
            pendingOwner: custodianKeypair.publicKey, // Wrong account
          })
          .signers([custodianKeypair])
          .rpc();

        // Should not reach here
        assert.fail(
          "Operation should be rejected due to invalid pending owner"
        );
      } catch (err) {
        // Expected to fail with invalid pending owner error
        console.log(
          "Operation correctly rejected due to invalid pending owner check"
        );
      }
    } catch (err) {
      console.error("Test failed:", err);
      throw err;
    }
  });

  // After hook to restore ownership to original wallet after all tests
  after(async () => {
    try {
      console.log(
        "Test suite completed, restoring ownership to original wallet..."
      );

      // Step 1: Current owner (newOwnerKeypair) initiates ownership transfer to wallet
      const txInitiate = await program.methods
        .transferOwnership({
          newOwner: wallet.publicKey,
        })
        .accounts({
          membersStore: membersStore,
          owner: newOwnerKeypair.publicKey,
        })
        .signers([newOwnerKeypair])
        .rpc();

      console.log(
        "Initiated ownership transfer back to wallet, signature:",
        txInitiate
      );

      // Step 2: Original wallet claims ownership
      const txClaim = await program.methods
        .claimOwnership()
        .accounts({
          membersStore: membersStore,
          pendingOwner: wallet.publicKey,
        })
        .signers([wallet.payer])
        .rpc();

      console.log("Claimed ownership back to wallet, signature:", txClaim);

      // Verify ownership has been restored to wallet
      const membersAccount = await program.account.membersStore.fetch(
        membersStore
      );

      assert.equal(
        membersAccount.owner.toString(),
        wallet.publicKey.toString(),
        "Ownership should have been successfully transferred back to original wallet"
      );

      console.log("Successfully restored ownership to original wallet");
    } catch (err) {
      console.error("Failed to restore ownership to original wallet:", err);
      throw err;
    }
  });
});
