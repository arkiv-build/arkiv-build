"use client";

import { createPublicClient, createWalletClient, custom, http } from "@arkiv-network/sdk";
import type { Hex } from "viem";

import { ARKIV_CHAIN, ARKIV_RPC_URL } from "@/lib/arkiv/chain";

const assertInjectedWallet = () => {
  if (!window.ethereum) {
    throw new Error("MetaMask is required to use Arkiv on Kaolin.");
  }

  return window.ethereum;
};

export const createArkivPublicClient = () =>
  createPublicClient({
    chain: ARKIV_CHAIN,
    transport: http(ARKIV_RPC_URL),
  });

export const createArkivWalletClient = (account: Hex) =>
  createWalletClient({
    chain: ARKIV_CHAIN,
    transport: custom(assertInjectedWallet()),
    account,
  });
