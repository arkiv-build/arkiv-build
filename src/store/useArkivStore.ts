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
  deployDraftEntitiesBatch,
  fetchEntitiesByProjectAttribute,
  fetchBlockTiming,
  fetchEntityDetails,
  fetchWalletOwnedEntities,
  updatePersistedEntity,
} from "@/lib/arkiv/entities";
import type { BlockTimingState, OwnedArkivEntitySummary, ProjectCollisionPrompt } from "@/lib/arkiv/types";
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
  type SchemaNode,
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
  checkingProjectCollision: boolean;
  projectCollisionPrompt?: ProjectCollisionPrompt;
  ignoredProjectAttributeValues: string[];
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
  loadProjectEntitiesIntoCanvas: (
    projectAttributeValue: string,
    options?: { keepCurrentCanvas?: boolean },
  ) => Promise<void>;
  checkProjectAttributeCollision: (projectAttributeValue: string) => Promise<void>;
  ignoreProjectCollisionPrompt: () => void;
  dismissProjectCollisionPrompt: () => void;
  deployActiveDraft: () => Promise<void>;
  deployDraft: (nodeId: string) => Promise<void>;
  deploySeededDraftsBatch: () => Promise<boolean>;
  updateActiveEntity: () => Promise<void>;
  disconnectWallet: () => void;
};

let unsubscribeWalletEvents: (() => void) | undefined;
let balanceRefreshPromise: Promise<void> | undefined;
let balanceSyncStop: (() => void) | undefined;
let projectCollisionRequestId = 0;

const BALANCE_SYNC_INTERVAL_MS = 20_000;
const PROJECT_ATTRIBUTE_KEY = 'project';
const LEGACY_PROJECT_ATTRIBUTE_KEY = 'PROJECT_ATTRIBUTE';

const normalizeAddress = (value?: string) => value?.trim().toLowerCase();
const normalizeProjectAttributeValue = (value: string) => value.trim().toLowerCase();

const getProjectAttributeValueForDraft = (node: SchemaNode) => {
  const fieldValue = node.data.fields.find((field) => {
    const name = field.name.trim();
    return name === LEGACY_PROJECT_ATTRIBUTE_KEY || name.toLowerCase() === PROJECT_ATTRIBUTE_KEY;
  })?.value.trim();

  return fieldValue || node.data.projectAttributeValue?.trim() || node.data.label.trim();
};

const buildProjectCollisionPrompt = ({
  account,
  projectAttributeValue,
  entities,
}: {
  account: Hex;
  projectAttributeValue: string;
  entities: OwnedArkivEntitySummary[];
}): ProjectCollisionPrompt | undefined => {
  if (entities.length === 0) {
    return undefined;
  }

  const normalizedAccount = normalizeAddress(account);
  const otherEntity = entities.find(
    (entity) => normalizeAddress(entity.creator) !== normalizedAccount,
  );

  return {
    projectAttributeValue,
    entities,
    sameCreator: otherEntity === undefined,
    otherCreator: otherEntity?.creator,
  };
};

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
  checkingProjectCollision: false,
  projectCollisionPrompt: undefined,
  ignoredProjectAttributeValues: [],
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
      const { account, ownedEntities, blockTiming } = get();
      const connectedKeys = findConnectedEntityKeys(entityKey, ownedEntities);

      const snapshots = await Promise.all(
        Array.from(connectedKeys).map((key) => fetchEntityDetails(key, blockTiming))
      );

      const { nodes, edges } = buildCanvasGraphFromSnapshots({
        snapshots,
        selectedEntityKey: entityKey,
        connectedAccount: account,
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
  loadProjectEntitiesIntoCanvas: async (projectAttributeValue, options) => {
    const { account } = get();

    if (!account) {
      set({
        error: 'Connect MetaMask to Arkiv Braga before loading project entities.',
      });
      return;
    }

    set({ loadingSelectedEntity: true, error: undefined });

    try {
      const entities = await fetchEntitiesByProjectAttribute(projectAttributeValue);

      if (entities.length === 0) {
        throw new Error('No entities were found for this project.');
      }

      const { blockTiming } = get();
      const snapshots = await Promise.all(
        entities.map((entity) => fetchEntityDetails(entity.key, blockTiming)),
      );
      const selectedEntity = entities.find(
        (entity) => normalizeAddress(entity.creator) === normalizeAddress(account),
      ) ?? entities[0];
      const { nodes, edges } = buildCanvasGraphFromSnapshots({
        snapshots,
        selectedEntityKey: selectedEntity.key,
        connectedAccount: account,
      });

      if (options?.keepCurrentCanvas) {
        useSchemaStore.getState().mergeGraphOfEntities(nodes, edges);
      } else {
        useSchemaStore.getState().loadGraphOfEntities(nodes, edges);
      }
      set({ projectCollisionPrompt: undefined });
      await get().refreshOwnedEntities();
    } catch (error) {
      set({
        error: getErrorMessage(error, 'Failed to load project entities into the canvas.'),
      });
    } finally {
      set({ loadingSelectedEntity: false });
    }
  },
  checkProjectAttributeCollision: async (projectAttributeValue) => {
    const { account, ignoredProjectAttributeValues } = get();
    const trimmedValue = projectAttributeValue.trim();
    const requestId = ++projectCollisionRequestId;

    if (
      !account ||
      !trimmedValue ||
      ignoredProjectAttributeValues.includes(normalizeProjectAttributeValue(trimmedValue))
    ) {
      set({
        checkingProjectCollision: false,
        projectCollisionPrompt: undefined,
      });
      return;
    }

    set({ checkingProjectCollision: true, error: undefined });

    try {
      const matchingEntities = await fetchEntitiesByProjectAttribute(trimmedValue);

      if (requestId !== projectCollisionRequestId) {
        return;
      }

      set({
        projectCollisionPrompt: buildProjectCollisionPrompt({
          account,
          projectAttributeValue: trimmedValue,
          entities: matchingEntities,
        }),
        checkingProjectCollision: false,
      });
    } catch {
      if (requestId !== projectCollisionRequestId) {
        return;
      }

      set({
        projectCollisionPrompt: undefined,
        checkingProjectCollision: false,
        error: 'Could not verify whether this project name is already in use.',
      });
    }
  },
  ignoreProjectCollisionPrompt: () => {
    const prompt = get().projectCollisionPrompt;

    if (!prompt) {
      return;
    }

    const normalizedValue = normalizeProjectAttributeValue(prompt.projectAttributeValue);

    set((state) => ({
      ignoredProjectAttributeValues: state.ignoredProjectAttributeValues.includes(normalizedValue)
        ? state.ignoredProjectAttributeValues
        : [...state.ignoredProjectAttributeValues, normalizedValue],
      projectCollisionPrompt: undefined,
      checkingProjectCollision: false,
    }));
  },
  dismissProjectCollisionPrompt: () => set({ projectCollisionPrompt: undefined }),
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
    const { account, ignoredProjectAttributeValues } = get();
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

    set({
      checkingProjectCollision: true,
      projectCollisionPrompt: undefined,
      error: undefined,
    });

    let collisionCheckComplete = false;

    try {
      const projectAttributeValue = getProjectAttributeValueForDraft(node);

      if (!projectAttributeValue) {
        throw new Error('Project name is required before deploying.');
      }

      const isIgnoredProject = ignoredProjectAttributeValues.includes(
        normalizeProjectAttributeValue(projectAttributeValue),
      );

      if (!isIgnoredProject) {
        const matchingEntities = await fetchEntitiesByProjectAttribute(projectAttributeValue);
        collisionCheckComplete = true;
        const collisionPrompt = buildProjectCollisionPrompt({
          account,
          projectAttributeValue,
          entities: matchingEntities,
        });

        if (collisionPrompt) {
          schemaStore.setProjectAttributeForConnectedDrafts(node.id, projectAttributeValue);
          set({
            projectCollisionPrompt: collisionPrompt,
            checkingProjectCollision: false,
          });
          return;
        }
      }

      set({
        checkingProjectCollision: false,
        deploying: true,
        deployingNodeId: node.id,
      });

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
        error: collisionCheckComplete
          ? getErrorMessage(error, 'Arkiv deployment failed in MetaMask.')
          : 'Could not verify whether this project name is already in use.',
      });
    } finally {
      set({ checkingProjectCollision: false, deploying: false, deployingNodeId: undefined });
    }
  },
  deploySeededDraftsBatch: async () => {
    const { account, ignoredProjectAttributeValues } = get();
    const schemaStore = useSchemaStore.getState();
    const draftNodes = schemaStore.nodes.filter((node) => node.data.mode === 'draft');

    if (!account) {
      set({
        error: 'Connect MetaMask to Arkiv Braga before deploying.',
      });
      return false;
    }

    if (draftNodes.length === 0) {
      set({
        error: 'Generate or add draft entities before deploying seed values.',
      });
      return false;
    }

    set({
      checkingProjectCollision: true,
      projectCollisionPrompt: undefined,
      error: undefined,
    });

    let collisionCheckComplete = false;

    try {
      const projectAttributeValue = getProjectAttributeValueForDraft(draftNodes[0]);

      if (!projectAttributeValue) {
        throw new Error('Project name is required before deploying.');
      }

      const normalizedProjectAttribute = normalizeProjectAttributeValue(projectAttributeValue);
      const isIgnoredProject = ignoredProjectAttributeValues.includes(normalizedProjectAttribute);

      if (!isIgnoredProject) {
        const matchingEntities = await fetchEntitiesByProjectAttribute(projectAttributeValue);
        collisionCheckComplete = true;
        const collisionPrompt = buildProjectCollisionPrompt({
          account,
          projectAttributeValue,
          entities: matchingEntities,
        });

        if (collisionPrompt) {
          schemaStore.setProjectAttributeForConnectedDrafts(draftNodes[0].id, projectAttributeValue);
          set({
            projectCollisionPrompt: collisionPrompt,
            checkingProjectCollision: false,
          });
          return false;
        }
      }

      set({
        checkingProjectCollision: false,
        deploying: true,
        deployingNodeId: undefined,
      });

      schemaStore.setProjectAttributeForConnectedDrafts(draftNodes[0].id, projectAttributeValue);

      const latestDraftNodes = useSchemaStore
        .getState()
        .nodes.filter((node) => node.data.mode === 'draft');
      const nodeIds = latestDraftNodes.map((node) => node.id);
      const { snapshots, txHash, relationUpdateTxHash, createdEntities } = await deployDraftEntitiesBatch({
        account,
        entities: latestDraftNodes.map((node) => ({
          nodeId: node.id,
          label: node.data.label,
          fields: node.data.fields,
          expirationDuration: node.data.expirationDuration,
          dataFields: node.data.dataFields,
          projectAttributeValue,
        })),
      });
      const snapshotsByNodeId = Object.fromEntries(
        snapshots.map((snapshot, index) => [nodeIds[index], snapshot]),
      );

      schemaStore.replaceDraftNodesWithPersistedBatch(snapshotsByNodeId);
      schemaStore.setBatchDeploymentContext({
        deployedAt: new Date().toISOString(),
        txHash,
        relationUpdateTxHash,
        entityCount: createdEntities.length,
        createdEntityKeys: createdEntities,
        usedGeneratedSeedValues: Boolean(schemaStore.seedGenerationContext),
        note:
          relationUpdateTxHash
            ? 'Created all draft entities, then wrote same-batch relation keys in a second Arkiv mutateEntities transaction.'
            : 'Created all draft entities in one Arkiv mutateEntities transaction.',
      });
      await get().refreshBlockTiming();
      await get().refreshBalance();
      await get().refreshOwnedEntities();
      return true;
    } catch (error) {
      set({
        error: collisionCheckComplete
          ? getErrorMessage(error, 'Arkiv batch deployment failed in MetaMask.')
          : 'Could not verify whether this project name is already in use.',
      });
      return false;
    } finally {
      set({ checkingProjectCollision: false, deploying: false, deployingNodeId: undefined });
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
