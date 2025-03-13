import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddress,
  setAuthority,
} from "@solana/spl-token";

// Import program types
import { Controller } from "../target/types/controller";
import { Members } from "../target/types/members";
import { Factory } from "../target/types/factory";

// Store initialized program states
let isInitialized = {
  members: false,
  controller: false,
  factory: false,
};

// Shared state object
export const sharedState = {
  membersStore: null as PublicKey | null,
  membersStoreBump: 0,
  controllerStore: null as PublicKey | null,
  controllerStoreBump: 0,
  factoryStore: null as PublicKey | null,
  factoryStoreBump: 0,
  tokenMint: null as PublicKey | null,
  controllerTokenAccount: null as PublicKey | null,
};

// Initialize Members program
export async function initializeMembers(
  program: Program<Members>,
  wallet: anchor.Wallet,
  force = false
) {
  if (isInitialized.members && !force) {
    console.log("Members already initialized, skipping");
    return sharedState.membersStore;
  }

  const walletKP = Keypair.fromSecretKey(wallet.payer.secretKey);

  // Find program address
  const [membersStore, membersStoreBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("members")],
    program.programId
  );

  sharedState.membersStore = membersStore;
  sharedState.membersStoreBump = membersStoreBump;

  // Check if account already exists
  try {
    await program.account.membersStore.fetch(membersStore);
    console.log("Members account already exists");
    isInitialized.members = true;
    return membersStore;
  } catch (e) {
    // If account doesn't exist, initialize it
    console.log("Initializing Members account");
    await program.methods
      .initialize()
      .accounts({
        payer: wallet.publicKey,
        membersStore: membersStore,
        systemProgram: SystemProgram.programId,
      })
      .signers([walletKP])
      .rpc();

    isInitialized.members = true;
    return membersStore;
  }
}

// Initialize Controller program
export async function initializeController(
  program: Program<Controller>,
  wallet: anchor.Wallet,
  force = false
) {
  if (isInitialized.controller && !force) {
    console.log("Controller already initialized, skipping");
    return {
      controllerStore: sharedState.controllerStore,
      tokenMint: sharedState.tokenMint,
    };
  }

  const walletKP = Keypair.fromSecretKey(wallet.payer.secretKey);

  // Find program address
  const [controllerStore, controllerStoreBump] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("controller")],
      program.programId
    );

  sharedState.controllerStore = controllerStore;
  sharedState.controllerStoreBump = controllerStoreBump;

  let tokenMint = sharedState.tokenMint;
  if (!tokenMint) {
    // Create token Mint account
    tokenMint = await createMint(
      program.provider.connection,
      walletKP,
      wallet.publicKey,
      wallet.publicKey,
      9 // Decimals
    );
    sharedState.tokenMint = tokenMint;
  }

  // Calculate Controller's token account address
  const controllerTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    controllerStore,
    true
  );
  sharedState.controllerTokenAccount = controllerTokenAccount;

  // Check if Controller account already exists
  try {
    await program.account.controllerStore.fetch(controllerStore);
    console.log("Controller account already exists");
    isInitialized.controller = true;
    return { controllerStore, tokenMint };
  } catch (e) {
    // If account doesn't exist, initialize it

    // Transfer Mint authority to Controller
    await setAuthority(
      program.provider.connection,
      walletKP,
      tokenMint,
      wallet.publicKey,
      0, // AuthorityType.MintTokens
      controllerStore
    );

    console.log("Initializing Controller account");
    await program.methods
      .initialize()
      .accounts({
        payer: wallet.publicKey,
        controllerStore: controllerStore,
        tokenMint: tokenMint,
        controllerTokenAccount: controllerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([walletKP])
      .rpc();

    isInitialized.controller = true;
    return { controllerStore, tokenMint };
  }
}

// Initialize Factory program
export async function initializeFactory(
  program: Program<Factory>,
  controllerProgramId: PublicKey,
  wallet: anchor.Wallet,
  force = false
) {
  if (isInitialized.factory && !force) {
    console.log("Factory already initialized, skipping");
    return sharedState.factoryStore;
  }

  const walletKP = Keypair.fromSecretKey(wallet.payer.secretKey);

  // Find program address
  const [factoryStore, factoryStoreBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("factory")],
    program.programId
  );

  sharedState.factoryStore = factoryStore;
  sharedState.factoryStoreBump = factoryStoreBump;

  // Check if Factory account already exists
  try {
    await program.account.factoryStore.fetch(factoryStore);
    console.log("Factory account already exists");
    isInitialized.factory = true;
    return factoryStore;
  } catch (e) {
    // If account doesn't exist, initialize it
    console.log("Initializing Factory account");
    await program.methods
      .initialize({
        controller: controllerProgramId,
      })
      .accounts({
        payer: wallet.publicKey,
        factoryStore: factoryStore,
        systemProgram: SystemProgram.programId,
      })
      .signers([walletKP])
      .rpc();

    isInitialized.factory = true;
    return factoryStore;
  }
}

// Configure Controller's Members and Factory associations
export async function configureController(
  program: Program<Controller>,
  membersProgram: PublicKey,
  factoryProgram: PublicKey,
  wallet: anchor.Wallet
) {
  if (!sharedState.controllerStore) {
    throw new Error("Controller not yet initialized");
  }

  const walletKP = Keypair.fromSecretKey(wallet.payer.secretKey);

  // Set Members
  await program.methods
    .setMembers({
      members: membersProgram,
    })
    .accounts({
      owner: wallet.publicKey,
      controllerStore: sharedState.controllerStore,
    })
    .signers([walletKP])
    .rpc();
  console.log("Controller's Members set to:", membersProgram.toString());

  // Set Factory
  await program.methods
    .setFactory({
      factory: factoryProgram,
    })
    .accounts({
      owner: wallet.publicKey,
      controllerStore: sharedState.controllerStore,
    })
    .signers([walletKP])
    .rpc();
  console.log("Controller's Factory set to:", factoryProgram.toString());
}

// Set Custodian
export async function setCustodian(
  program: Program<Members>,
  custodian: PublicKey,
  wallet: anchor.Wallet
) {
  if (!sharedState.membersStore) {
    throw new Error("Members not yet initialized");
  }

  const walletKP = Keypair.fromSecretKey(wallet.payer.secretKey);

  // Set custodian
  await program.methods
    .setCustodian({
      custodian: custodian,
    })
    .accounts({
      owner: wallet.publicKey,
      membersStore: sharedState.membersStore,
      systemProgram: SystemProgram.programId,
    })
    .signers([walletKP])
    .rpc();
  console.log("Custodian set to:", custodian.toString());
}

// Add Merchant
export async function addMerchant(
  program: Program<Members>,
  merchant: PublicKey,
  wallet: anchor.Wallet
) {
  if (!sharedState.membersStore) {
    throw new Error("Members not yet initialized");
  }

  const walletKP = Keypair.fromSecretKey(wallet.payer.secretKey);

  // Add merchant
  await program.methods
    .addMerchant({
      merchant: merchant,
    })
    .accounts({
      owner: wallet.publicKey,
      membersStore: sharedState.membersStore,
      systemProgram: SystemProgram.programId,
    })
    .signers([walletKP])
    .rpc();
  console.log("Merchant added:", merchant.toString());
}
