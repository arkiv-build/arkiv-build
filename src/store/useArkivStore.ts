"use client";

import { create } from "zustand";
import type { Hex } from "viem";

import { isArkivKaolinChain } from "@/lib/arkiv/chain";
import {
  deployEntityFromDraft,
  fetchBlockTiming,
  fetchEntityDetails,
  fetchWalletOwnedEntities,
} from "@/lib/arkiv/entities";
import type { BlockTimingState, OwnedArkivEntitySummary } from "@/lib/arkiv/types";
import {
  connectMetaMask,
  ensureArkivNetworkReady,
  getAuthorizedAccount,
  getInjectedChainId,
  hasMetaMask,
  subscribeWalletEvents,
} from "@/lib/arkiv/wallet";
import { useSchemaStore } from "@/store/useSchemaStore";

type ArkivState = {
  initialized: boolean;
  walletAvailable: boolean;
  account?: Hex;
  chainId?: number;
  blockTiming?: BlockTimingState;
  ownedEntities: OwnedArkivEntitySummary[];
  loadingOwnedEntities: boolean;
  loadingSelectedEntity: boolean;
  connecting: boolean;
  deploying: boolean;
  error?: string;
  networkNudge?: string;
  initialize: () => Promise<void>;
  connectWallet: () => Promise<void>;
  retryNetworkSwitch: () => Promise<void>;
  refreshBlockTiming: () => Promise<void>;
  refreshOwnedEntities: () => Promise<void>;
  loadEntityIntoCanvas: (entityKey: Hex) => Promise<void>;
  deployActiveDraft: () => Promise<void>;
};

let unsubscribeWalletEvents: (() => void) | undefined;

export const useArkivStore = create<ArkivState>((set, get) => ({
  initialized: false,
  walletAvailable: false,
  ownedEntities: [],
  loadingOwnedEntities: false,
  loadingSelectedEntity: false,
  connecting: false,
  deploying: false,
  initialize: async () => {
    if (get().initialized) {
      return;
    }

    const walletAvailable = hasMetaMask();
    const chainId = walletAvailable ? await getInjectedChainId() : undefined;

    set({
      initialized: true,
      walletAvailable,
      chainId,
      networkNudge:
        walletAvailable && !isArkivKaolinChain(chainId)
          ? "Switch MetaMask to the Arkiv Kaolin testnet to browse and deploy entities."
          : undefined,
    });

    try {
      await get().refreshBlockTiming();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch Kaolin block timing.",
      });
    }

    if (!walletAvailable) {
      set({
        error:
          "MetaMask was not detected. Install MetaMask to fetch your Arkiv entities and deploy new ones.",
      });
      return;
    }

    unsubscribeWalletEvents?.();
    unsubscribeWalletEvents = subscribeWalletEvents({
      onAccountsChanged: async (account) => {
        set({ account });

        if (account && isArkivKaolinChain(await getInjectedChainId())) {
          await get().refreshOwnedEntities();
        } else {
          set({ ownedEntities: [] });
          useSchemaStore.getState().resetToSingleDraft();
        }
      },
      onChainChanged: async (nextChainId) => {
        const onCorrectNetwork = isArkivKaolinChain(nextChainId);

        set({
          chainId: nextChainId,
          networkNudge: onCorrectNetwork
            ? undefined
            : "MetaMask is connected to the wrong network. Switch to Arkiv Kaolin to continue.",
        });

        if (onCorrectNetwork) {
          await get().refreshBlockTiming();

          if (get().account) {
            await get().refreshOwnedEntities();
          }
        }
      },
    });

    const account = await getAuthorizedAccount();
    set({ account });

    if (account && isArkivKaolinChain(chainId)) {
      await get().refreshOwnedEntities();
    }
  },
  connectWallet: async () => {
    set({ connecting: true, error: undefined });

    try {
      const account = await connectMetaMask();
      const chainId = await getInjectedChainId();

      set({
        account,
        chainId,
        walletAvailable: true,
        networkNudge: isArkivKaolinChain(chainId)
          ? undefined
          : "MetaMask is connected, but not to Arkiv Kaolin yet.",
      });

      await get().refreshBlockTiming();
      await get().refreshOwnedEntities();
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "MetaMask connection to Arkiv Kaolin failed.",
      });
    } finally {
      set({ connecting: false });
    }
  },
  retryNetworkSwitch: async () => {
    try {
      await ensureArkivNetworkReady();
      const chainId = await getInjectedChainId();

      set({
        chainId,
        networkNudge: undefined,
        error: undefined,
      });

      await get().refreshBlockTiming();

      if (get().account) {
        await get().refreshOwnedEntities();
      }
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Switching MetaMask to Arkiv Kaolin failed.",
      });
    }
  },
  refreshBlockTiming: async () => {
    const blockTiming = await fetchBlockTiming();
    set({ blockTiming });
  },
  refreshOwnedEntities: async () => {
    const { account } = get();

    if (!account) {
      set({ ownedEntities: [] });
      return;
    }

    set({ loadingOwnedEntities: true, error: undefined });

    try {
      const ownedEntities = await fetchWalletOwnedEntities(account);
      set({ ownedEntities });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to load wallet-owned Arkiv entities.",
      });
    } finally {
      set({ loadingOwnedEntities: false });
    }
  },
  loadEntityIntoCanvas: async (entityKey) => {
    set({ loadingSelectedEntity: true, error: undefined });

    try {
      const snapshot = await fetchEntityDetails(entityKey, get().blockTiming);
      useSchemaStore.getState().openPersistedEntity(snapshot);
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch the selected Arkiv entity.",
      });
    } finally {
      set({ loadingSelectedEntity: false });
    }
  },
  deployActiveDraft: async () => {
    const { account } = get();
    const schemaStore = useSchemaStore.getState();
    const activeNode = schemaStore.getActiveNode();

    if (!account) {
      set({
        error: "Connect MetaMask to Arkiv Kaolin before deploying.",
      });
      return;
    }

    if (!activeNode || activeNode.data.mode !== "draft") {
      set({
        error: "Select a draft entity on the canvas before deploying.",
      });
      return;
    }

    set({ deploying: true, error: undefined });

    try {
      const { snapshot } = await deployEntityFromDraft({
        account,
        label: activeNode.data.label,
        fields: activeNode.data.fields,
        expirationDuration: activeNode.data.expirationDuration,
      });

      schemaStore.replaceNodeWithPersisted(activeNode.id, snapshot);
      await get().refreshBlockTiming();
      await get().refreshOwnedEntities();
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Arkiv deployment failed in MetaMask.",
      });
    } finally {
      set({ deploying: false });
    }
  },
}));
