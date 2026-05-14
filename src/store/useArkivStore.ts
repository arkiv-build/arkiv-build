"use client";

import { create } from "zustand";
import type { Hex } from "viem";

import { isArkivBragaChain } from "@/lib/arkiv/chain";
import {
  buildCanvasGraphFromSnapshots,
  findConnectedEntityKeys,
} from "@/lib/arkiv/entityGraph";
import {
  deployEntityFromDraft,
  fetchBlockTiming,
  fetchEntityDetails,
  fetchWalletOwnedEntities,
  updatePersistedEntity,
} from "@/lib/arkiv/entities";
import type { BlockTimingState, OwnedArkivEntitySummary } from "@/lib/arkiv/types";
import { getErrorMessage } from "@/lib/errors";
import {
  connectMetaMask,
  ensureArkivNetworkReady,
  getAccountBalance,
  getAuthorizedAccount,
  getInjectedChainId,
  hasMetaMask,
  subscribeWalletEvents,
} from "@/lib/arkiv/wallet";
import {
  useSchemaStore,
} from "@/store/useSchemaStore";

type ArkivState = {
  initialized: boolean;
  walletAvailable: boolean;
  account?: Hex;
  chainId?: number;
  balance?: string;
  blockTiming?: BlockTimingState;
  ownedEntities: OwnedArkivEntitySummary[];
  loadingOwnedEntities: boolean;
  loadingSelectedEntity: boolean;
  connecting: boolean;
  deploying: boolean;
  deployingNodeId?: string;
  updating: boolean;
  error?: string;
  networkNudge?: string;
  initialize: () => Promise<void>;
  connectWallet: () => Promise<void>;
  retryNetworkSwitch: () => Promise<void>;
  refreshBlockTiming: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  startBalanceSync: () => () => void;
  refreshOwnedEntities: () => Promise<void>;
  loadEntityIntoCanvas: (entityKey: Hex) => Promise<void>;
  deployActiveDraft: () => Promise<void>;
  deployDraft: (nodeId: string) => Promise<void>;
  updateActiveEntity: () => Promise<void>;
  disconnectWallet: () => void;
};

let unsubscribeWalletEvents: (() => void) | undefined;
let balanceRefreshPromise: Promise<void> | undefined;
let balanceSyncStop: (() => void) | undefined;

const BALANCE_SYNC_INTERVAL_MS = 20_000;

export const useArkivStore = create<ArkivState>((set, get) => ({
  initialized: false,
  walletAvailable: false,
  balance: undefined,
  ownedEntities: [],
  loadingOwnedEntities: false,
  loadingSelectedEntity: false,
  connecting: false,
  deploying: false,
  deployingNodeId: undefined,
  updating: false,
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
        walletAvailable && !isArkivBragaChain(chainId)
          ? "Switch MetaMask to the Arkiv Braga testnet to browse and deploy entities."
          : undefined,
    });

    try {
      await get().refreshBlockTiming();
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to fetch Braga block timing."),
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
        const chainId = await getInjectedChainId();

        set({ account, chainId });

        if (account && isArkivBragaChain(chainId)) {
          await get().refreshBalance();
          await get().refreshOwnedEntities();
        } else {
          set({ balance: undefined, ownedEntities: [] });
          useSchemaStore.getState().resetToSingleDraft();
        }
      },
      onChainChanged: async (nextChainId) => {
        const onCorrectNetwork = isArkivBragaChain(nextChainId);

        set({
          chainId: nextChainId,
          balance: onCorrectNetwork ? get().balance : undefined,
          networkNudge: onCorrectNetwork
            ? undefined
            : "MetaMask is connected to the wrong network. Switch to Arkiv Braga to continue.",
        });

        if (onCorrectNetwork) {
          await get().refreshBlockTiming();

          if (get().account) {
            await get().refreshBalance();
            await get().refreshOwnedEntities();
          }
        }
      },
    });

    const account = await getAuthorizedAccount();
    set({ account });

    if (account && isArkivBragaChain(chainId)) {
      await get().refreshBalance();
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
        networkNudge: isArkivBragaChain(chainId)
          ? undefined
          : "MetaMask is connected, but not to Arkiv Braga yet.",
      });

      await get().refreshBlockTiming();
      await get().refreshBalance();
      await get().refreshOwnedEntities();
    } catch (error) {
      set({
        error: getErrorMessage(error, "MetaMask connection to Arkiv Braga failed."),
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
        await get().refreshBalance();
        await get().refreshOwnedEntities();
      }
    } catch (error) {
      set({
        error: getErrorMessage(error, "Switching MetaMask to Arkiv Braga failed."),
      });
    }
  },
  refreshBlockTiming: async () => {
    const blockTiming = await fetchBlockTiming();
    set({ blockTiming });
  },
  refreshBalance: async () => {
    if (balanceRefreshPromise) {
      return balanceRefreshPromise;
    }

    balanceRefreshPromise = (async () => {
      const { account, chainId } = get();
      if (!account) {
        set({ balance: undefined });
        return;
      }

      const injectedChainId = await getInjectedChainId();
      const activeChainId = injectedChainId ?? chainId;

      if (!isArkivBragaChain(activeChainId)) {
        set({ chainId: activeChainId, balance: undefined });
        return;
      }

      if (activeChainId !== chainId) {
        set({ chainId: activeChainId });
      }

      const balance = await getAccountBalance(account);
      const latestState = get();

      if (latestState.account === account && isArkivBragaChain(latestState.chainId)) {
        set({ balance });
      }
    })().finally(() => {
      balanceRefreshPromise = undefined;
    });

    return balanceRefreshPromise;
  },
  startBalanceSync: () => {
    balanceSyncStop?.();

    const refreshIfActive = () => {
      const { account, chainId } = get();

      if (!account || !isArkivBragaChain(chainId) || document.hidden) {
        return;
      }

      void get().refreshBalance();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshIfActive();
      }
    };

    const intervalId = window.setInterval(refreshIfActive, BALANCE_SYNC_INTERVAL_MS);

    window.addEventListener('focus', refreshIfActive);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    refreshIfActive();

    balanceSyncStop = () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshIfActive);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      balanceSyncStop = undefined;
    };

    return balanceSyncStop;
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
        error: getErrorMessage(error, "Failed to load wallet-owned Arkiv entities."),
      });
    } finally {
      set({ loadingOwnedEntities: false });
    }
  },
  loadEntityIntoCanvas: async (entityKey) => {
    set({ loadingSelectedEntity: true, error: undefined });

    try {
      const { ownedEntities, blockTiming } = get();
      const connectedKeys = findConnectedEntityKeys(entityKey, ownedEntities);

      const snapshots = await Promise.all(
        Array.from(connectedKeys).map((key) => fetchEntityDetails(key, blockTiming))
      );

      const { nodes, edges } = buildCanvasGraphFromSnapshots({
        snapshots,
        selectedEntityKey: entityKey,
      });

      useSchemaStore.getState().loadGraphOfEntities(nodes, edges);

    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to fetch the selected Arkiv entity."),
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
        error: "Connect MetaMask to Arkiv Braga before deploying.",
      });
      return;
    }

    if (!activeNode || activeNode.data.mode !== "draft") {
      set({
        error: "Select a draft entity on the canvas before deploying.",
      });
      return;
    }

    await get().deployDraft(activeNode.id);
  },
  deployDraft: async (nodeId: string) => {
    const { account } = get();
    const schemaStore = useSchemaStore.getState();
    const node = schemaStore.nodes.find((n) => n.id === nodeId);

    if (!account) {
      set({
        error: 'Connect MetaMask to Arkiv Braga before deploying.',
      });
      return;
    }

    if (!node || node.data.mode !== 'draft') {
      set({
        error: 'The selected entity is not a draft.',
      });
      return;
    }

    set({ deploying: true, deployingNodeId: node.id, error: undefined });

    try {
      const projectAttributeValue =
        node.data.projectAttributeValue ?? node.data.label.trim();

      schemaStore.setProjectAttributeForConnectedDrafts(node.id, projectAttributeValue);

      const { snapshot } = await deployEntityFromDraft({
        account,
        label: node.data.label,
        fields: node.data.fields,
        expirationDuration: node.data.expirationDuration,
        dataFields: node.data.dataFields,
        projectAttributeValue,
      });

      schemaStore.setDeployFailed(node.id, false);
      schemaStore.replaceNodeWithPersisted(node.id, snapshot);
      await get().refreshBlockTiming();
      await get().refreshBalance();
      await get().refreshOwnedEntities();
    } catch (error) {
      schemaStore.setDeployFailed(node.id, true);
      set({
        error: getErrorMessage(error, 'Arkiv deployment failed in MetaMask.'),
      });
    } finally {
      set({ deploying: false, deployingNodeId: undefined });
    }
  },
  updateActiveEntity: async () => {
    const { account, blockTiming } = get();
    const schemaStore = useSchemaStore.getState();
    const activeNode = schemaStore.getActiveNode();

    if (!account) {
      set({
        error: 'Connect MetaMask to Arkiv Braga before updating.',
      });
      return;
    }

    if (!activeNode || activeNode.data.mode !== 'persisted') {
      set({
        error: 'Select a deployed entity on the canvas before updating.',
      });
      return;
    }

    const entityKey = activeNode.data.entityKey;

    if (!entityKey) {
      set({ error: 'Entity key is missing — cannot update.' });
      return;
    }

    // Extract the on-chain expiration block from the system attributes so we can
    // preserve the existing TTL. The $expiration attribute is a formatted number
    // string (e.g. "1,234,567") — strip commas before parsing.
    const expirationAttr = activeNode.data.systemAttributes?.find(
      (a) => a.name === '$expiration',
    );
    const expirationBlock = expirationAttr
      ? BigInt(expirationAttr.value.replace(/,/g, ''))
      : BigInt(0);

    // Fall back to a fresh block timing fetch if store value is missing.
    let currentBlock = blockTiming ? BigInt(blockTiming.currentBlock) : BigInt(0);
    if (currentBlock === BigInt(0)) {
      try {
        const fresh = await fetchBlockTiming();
        currentBlock = BigInt(fresh.currentBlock);
        set({ blockTiming: fresh });
      } catch {
        // leave currentBlock as 0; remainingBlocks will clamp to 1
      }
    }

    set({ updating: true, error: undefined });

    try {
      const { snapshot } = await updatePersistedEntity({
        account,
        entityKey,
        label: activeNode.data.label,
        fields: activeNode.data.fields,
        entityData: activeNode.data.entityData,
        projectAttributeValue: activeNode.data.projectAttributeValue,
        currentBlock,
        expirationBlock,
      });

      schemaStore.replaceNodeWithPersisted(activeNode.id, snapshot);
      await get().refreshBlockTiming();
      await get().refreshBalance();
      await get().refreshOwnedEntities();
    } catch (error) {
      set({
        error: getErrorMessage(error, 'Arkiv update transaction failed.'),
      });
    } finally {
      set({ updating: false });
    }
  },
  disconnectWallet: () => {
    set({
      account: undefined,
      balance: undefined,
      ownedEntities: [],
    });
    useSchemaStore.getState().resetToSingleDraft();
  },
}));
