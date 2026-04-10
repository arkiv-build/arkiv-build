"use client";

import "viem/window";

import type { Hex } from "viem";

import { ARKIV_CHAIN, ARKIV_CHAIN_HEX, isArkivKaolinChain } from "@/lib/arkiv/chain";

type WalletEvents = {
  onAccountsChanged?: (account?: Hex) => void;
  onChainChanged?: (chainId?: number) => void;
};

export const hasMetaMask = () => Boolean(window.ethereum);

export const getInjectedChainId = async () => {
  if (!window.ethereum) {
    return undefined;
  }

  const chainIdHex = await window.ethereum.request({
    method: "eth_chainId",
  });

  if (typeof chainIdHex !== "string") {
    return undefined;
  }

  return Number.parseInt(chainIdHex, 16);
};

export const getAuthorizedAccount = async () => {
  if (!window.ethereum) {
    return undefined;
  }

  const accounts = await window.ethereum.request({
    method: "eth_accounts",
  });

  if (!Array.isArray(accounts) || accounts.length === 0) {
    return undefined;
  }

  return accounts[0] as Hex;
};

export const switchToArkivKaolin = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARKIV_CHAIN_HEX }],
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 4902
    ) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ARKIV_CHAIN_HEX,
            chainName: ARKIV_CHAIN.name,
            nativeCurrency: ARKIV_CHAIN.nativeCurrency,
            rpcUrls: ARKIV_CHAIN.rpcUrls.default.http,
            blockExplorerUrls: ARKIV_CHAIN.blockExplorers?.default.url
              ? [ARKIV_CHAIN.blockExplorers.default.url]
              : [],
          },
        ],
      });

      return;
    }

    throw error;
  }
};

export const connectMetaMask = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  await switchToArkivKaolin();

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("No MetaMask account was returned.");
  }

  return accounts[0] as Hex;
};

export const ensureArkivNetworkReady = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  const chainId = await getInjectedChainId();

  if (isArkivKaolinChain(chainId)) {
    return;
  }

  await switchToArkivKaolin();
};

export const subscribeWalletEvents = ({ onAccountsChanged, onChainChanged }: WalletEvents) => {
  if (!window.ethereum?.on) {
    return () => undefined;
  }

  const handleAccountsChanged = (accounts: string[]) => {
    onAccountsChanged?.(accounts[0] as Hex | undefined);
  };

  const handleChainChanged = (chainIdHex: string) => {
    onChainChanged?.(Number.parseInt(chainIdHex, 16));
  };

  window.ethereum.on("accountsChanged", handleAccountsChanged);
  window.ethereum.on("chainChanged", handleChainChanged);

  return () => {
    window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
  };
};
