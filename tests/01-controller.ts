// Controller program test file
// Tests for wBTC controller smart contract functionality on Solana
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Controller } from "../target/types/controller";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  setAuthority,
} from "@solana/spl-token";
import { assert } from "chai";
import { Members } from "../target/types/members";
import { Factory } from "../target/types/factory";
import {
  initializeController,
  initializeMembers,
  sharedState,
  configureController,
} from "../helpers/test-setup";

describe("Controller Program Tests", () => {
  // Configure Anchor provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Get Controller program
  const program = anchor.workspace.Controller as Program<Controller>;

  // Account variables
  const wallet = provider.wallet as anchor.Wallet;
  let tokenMint: PublicKey;
  let controllerStore: PublicKey;
  let controllerBump: number;
  let controllerTokenAccount: PublicKey;
  let userTokenAccount: PublicKey;
  let factoryKeypair: Keypair;
  let membersKeypair: Keypair;
  let newOwnerKeypair: Keypair;
  // Store mint authority keypair for restoration after tests
  let mintAuthorityKeypair: Keypair | null = null;

  // Constants - match with program
  const CONTROLLER_SEED = "controller";
  const membersProgram = anchor.workspace.Members as Program<Members>;
  const factoryProgram = anchor.workspace.Factory as Program<Factory>;

  // Set up environment before all tests
  before(async () => {
    console.log("Setting up test environment...");

    // Create test key pairs
    factoryKeypair = anchor.web3.Keypair.generate();
    membersKeypair = anchor.web3.Keypair.generate();
    newOwnerKeypair = anchor.web3.Keypair.generate();

    // Initialize Members and Controller programs using helper module
    await initializeMembers(membersProgram, wallet);

    // Initialize Controller with newOwnerKeypair instead of wallet
    // Airdrop SOL to newOwnerKeypair to pay for transaction fees
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        newOwnerKeypair.publicKey,
        2000000000
      ) // 2 SOL
    );
    const result = await initializeController(program, {
      publicKey: newOwnerKeypair.publicKey,
      payer: newOwnerKeypair,
    } as anchor.Wallet);
    controllerStore = result.controllerStore as PublicKey;
    tokenMint = result.tokenMint as PublicKey;

    controllerBump = sharedState.controllerStoreBump;
    controllerTokenAccount = sharedState.controllerTokenAccount as PublicKey;

    console.log(
      `Controller PDA: ${controllerStore.toString()}, Bump: ${controllerBump}`
    );
    console.log(
      `Controller token account address: ${controllerTokenAccount.toString()}`
    );

    // Calculate user token account address
    userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );
    console.log(`User token account address: ${userTokenAccount.toString()}`);
  });

  // Verify initialization state
  it("Controller account should be properly initialized", async () => {
    try {
      // Get Controller account state
      const controllerAccount = await program.account.controllerStore.fetch(
        controllerStore
      );

      // Assert initialization state is correct
      assert.equal(
        controllerAccount.tokenMint.toString(),
        tokenMint.toString()
      );
      assert.equal(
        controllerAccount.owner.toString(),
        newOwnerKeypair.publicKey.toString()
      );
      assert.equal(
        controllerAccount.pendingOwner.toString(),
        PublicKey.default.toString()
      );

      // Verify that the controller's Associated Token Account was created successfully
      try {
        const tokenAccountInfo = await getAccount(
          provider.connection,
          controllerTokenAccount
        );

        // Verify the token account properties
        assert.ok(tokenAccountInfo, "Controller token account should exist");
        assert.equal(
          tokenAccountInfo.mint.toString(),
          tokenMint.toString(),
          "Token account mint should match"
        );
        assert.equal(
          tokenAccountInfo.owner.toString(),
          controllerStore.toString(),
          "Token account owner should be the controller PDA"
        );
        assert.equal(
          tokenAccountInfo.amount.toString(),
          "0",
          "Initial token balance should be 0"
        );

        console.log("Controller initialization verified successfully");
      } catch (err) {
        console.error("Failed to verify controller token account:", err);
        throw new Error("Controller token account verification failed");
      }
    } catch (err) {
      console.error("Verification failed:", err);
      throw err;
    }
  });

  // Test setting Members and Factory program IDs
  it("Set members program ID", async () => {
    try {
      // Configure Controller with helper function
      await configureController(
        program,
        membersProgram.programId,
        factoryProgram.programId,
        {
          publicKey: newOwnerKeypair.publicKey,
          payer: newOwnerKeypair,
        } as anchor.Wallet
      );

      // Get updated Controller account state
      const controllerAccount = await program.account.controllerStore.fetch(
        controllerStore
      );

      // Assert Members is set correctly
      assert.equal(
        controllerAccount.members.toString(),
        membersProgram.programId.toString()
      );

      // Assert Factory is set correctly
      assert.equal(
        controllerAccount.factory.toString(),
        factoryProgram.programId.toString()
      );
    } catch (err) {
      console.error("Set Members/Factory failed:", err);
      throw err;
    }
  });

  // Test minting permission check
  it("Should reject mint operations not called from Factory program", async () => {
    try {
      // Try to call mint instruction directly (should fail)
      const testAmount = new anchor.BN(1000000000); // 1 token

      try {
        await program.methods
          .mint({
            to: wallet.publicKey,
            amount: testAmount,
          })
          .accounts({
            controllerStore: controllerStore,
            tokenMint: tokenMint,
            tokenAccount: userTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            factoryProgram: factoryKeypair.publicKey, // Using incorrect program ID
            instructionSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          })
          .rpc();

        // If execution reaches here, test should fail as operation should be rejected
        assert.fail("Mint operation should be rejected but succeeded");
      } catch (err) {
        // Expect operation to be rejected
        console.log("Mint operation correctly rejected");
      }
    } catch (err) {
      console.error("Testing mint failed:", err);
      throw err;
    }
  });

  // Test burning permission check
  it("Should reject burn operations not called from Factory program", async () => {
    try {
      // Try to call burn instruction directly (should fail)
      const testAmount = new anchor.BN(1000000000); // 1 token

      try {
        await program.methods
          .burn({
            amount: testAmount,
          })
          .accounts({
            controllerStore: controllerStore,
            tokenMint: tokenMint,
            controllerTokenAccount: controllerTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            factoryProgram: factoryKeypair.publicKey, // Using incorrect program ID
            instructionSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          })
          .rpc();

        // If execution reaches here, test should fail as operation should be rejected
        assert.fail("Burn operation should be rejected but succeeded");
      } catch (err) {
        // Expect operation to be rejected
        console.log("Burn operation correctly rejected");
      }
    } catch (err) {
      console.error("Testing burn failed:", err);
      throw err;
    }
  });

  // Test start ownership transfer
  it("Start ownership transfer", async () => {
    try {
      // Call transferOwnership instruction
      const tx = await program.methods
        .transferOwnership({
          newOwner: wallet.publicKey,
        })
        .accounts({
          controllerStore: controllerStore,
          owner: newOwnerKeypair.publicKey,
        })
        .signers([newOwnerKeypair]) // Requires current owner's signature
        .rpc();

      console.log("Start ownership transfer transaction signature:", tx);

      // Get updated Controller account state
      const controllerAccount = await program.account.controllerStore.fetch(
        controllerStore
      );

      // Assert pendingOwner is set correctly
      assert.equal(
        controllerAccount.pendingOwner.toString(),
        wallet.publicKey.toString()
      );
      // Confirm current owner has not changed
      assert.equal(
        controllerAccount.owner.toString(),
        newOwnerKeypair.publicKey.toString()
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
          controllerStore: controllerStore,
          pendingOwner: wallet.publicKey,
        })
        .signers([wallet.payer]) // Sign with wallet instead of newOwnerKeypair
        .rpc();

      console.log("Accept ownership transfer transaction signature:", tx);

      // Get updated Controller account state
      const controllerAccount = await program.account.controllerStore.fetch(
        controllerStore
      );

      // Assert ownership has been transferred
      assert.equal(
        controllerAccount.owner.toString(),
        wallet.publicKey.toString()
      );
      // pendingOwner should be reset
      assert.equal(
        controllerAccount.pendingOwner.toString(),
        PublicKey.default.toString()
      );
    } catch (err) {
      console.error("Accept ownership transfer failed:", err);
      throw err;
    }
  });

  // Test new owner permissions
  it("New owner sets Members", async () => {
    try {
      // Create new members account
      const newMembersKeypair = anchor.web3.Keypair.generate();

      // Call setMembers instruction as new owner
      const tx = await program.methods
        .setMembers({
          members: newMembersKeypair.publicKey,
        })
        .accounts({
          controllerStore: controllerStore,
          owner: wallet.publicKey,
        })
        .signers([wallet.payer]) // Sign with wallet instead of newOwnerKeypair
        .rpc();

      console.log("New owner sets Members transaction signature:", tx);

      // Get updated Controller account state
      const controllerAccount = await program.account.controllerStore.fetch(
        controllerStore
      );

      // Assert Members is set correctly
      assert.equal(
        controllerAccount.members.toString(),
        newMembersKeypair.publicKey.toString()
      );
    } catch (err) {
      console.error("New owner setting Members failed:", err);
      throw err;
    }
  });

  // Test transfer mint authority functionality
  it("Transfer mint authority to a new authority (two-step process)", async () => {
    try {
      // Create new authority for mint
      const newMintAuthorityKeypair = anchor.web3.Keypair.generate();

      // Step 1: Current owner initiates mint authority transfer
      console.log("Step 1: Setting pending mint authority...");
      const txSetPending = await program.methods
        .transferMintAuthority({
          newAuthority: newMintAuthorityKeypair.publicKey,
        })
        .accounts({
          controllerStore: controllerStore,
          owner: wallet.publicKey,
          tokenMint: tokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([wallet.payer]) // Sign with wallet instead of newOwnerKeypair
        .rpc();

      console.log(
        "Set pending mint authority transaction signature:",
        txSetPending
      );

      // Fetch controller state to verify pending mint authority is set
      const controllerAccount = await program.account.controllerStore.fetch(
        controllerStore
      );

      // Assert pending mint authority is set correctly
      assert.equal(
        controllerAccount.pendingMintAuthority.toString(),
        newMintAuthorityKeypair.publicKey.toString(),
        "Pending mint authority should be set correctly"
      );

      // Airdrop SOL to new mint authority for transaction fees
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          newMintAuthorityKeypair.publicKey,
          1000000000
        ) // 1 SOL
      );

      // Step 2: New authority claims the mint authority
      console.log("Step 2: Claiming mint authority...");

      const claimTx = await program.methods
        .claimMintAuthority()
        .accounts({
          controllerStore: controllerStore,
          pendingAuthority: newMintAuthorityKeypair.publicKey,
          tokenMint: tokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([newMintAuthorityKeypair])
        .rpc();

      console.log("Claim mint authority transaction signature:", claimTx);

      // Verify that pending mint authority is reset to default
      const updatedControllerAccount =
        await program.account.controllerStore.fetch(controllerStore);
      assert.equal(
        updatedControllerAccount.pendingMintAuthority.toString(),
        PublicKey.default.toString(),
        "Pending mint authority should be reset after claim"
      );

      // Verify mint authority is changed at token mint level
      const mintInfo = await provider.connection.getParsedAccountInfo(
        tokenMint
      );
      if (mintInfo.value) {
        const parsedData = (mintInfo.value.data as any).parsed;
        console.log(
          `\nCurrent mint authority: ${parsedData.info.mintAuthority}`
        );

        // Verify mint authority has been successfully transferred to the new authority
        assert.equal(
          parsedData.info.mintAuthority,
          newMintAuthorityKeypair.publicKey.toString(),
          "Mint authority should have been successfully transferred to the new authority"
        );

        console.log(
          `Mint authority successfully transferred to: ${newMintAuthorityKeypair.publicKey.toString()}`
        );
      } else {
        console.error("Unable to get token mint account information");
        throw new Error("Failed to get token mint account information");
      }

      console.log("Mint authority transfer process completed");

      // Save newMintAuthorityKeypair for use in after hook
      mintAuthorityKeypair = newMintAuthorityKeypair;
    } catch (err) {
      console.error("Transfer mint authority process failed:", err);
      throw err;
    }
  });

  // After hook to restore mint authority to Controller after all tests
  after(async () => {
    try {
      // Check if mint authority needs to be restored
      if (!mintAuthorityKeypair) {
        console.log("No mint authority to restore, skipping");
        return;
      }

      console.log(
        "Test suite completed, restoring token mint authority to Controller..."
      );

      // Transfer mint authority directly from current authority to Controller PDA
      await setAuthority(
        provider.connection,
        mintAuthorityKeypair, // Transaction payer
        tokenMint, // Token mint account
        mintAuthorityKeypair.publicKey, // Current mint authority
        0, // AuthorityType.MintTokens
        controllerStore, // New mint authority (Controller)
        [mintAuthorityKeypair] // Signers array
      );

      // Verify mint authority has been successfully restored to Controller
      const mintInfo = await provider.connection.getParsedAccountInfo(
        tokenMint
      );
      if (mintInfo.value) {
        const parsedData = (mintInfo.value.data as any).parsed;
        console.log(
          `\nMint authority restored to: ${parsedData.info.mintAuthority}`
        );
        assert.equal(
          parsedData.info.mintAuthority,
          controllerStore.toString(),
          "Mint authority should have been successfully transferred back to Controller"
        );
      }

      console.log("Successfully restored Controller's mint authority");
    } catch (err) {
      console.error("Failed to restore mint authority:", err);
      throw err;
    }
  });
});
