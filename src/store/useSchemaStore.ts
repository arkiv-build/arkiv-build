"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { create } from "zustand";
import type { Hex } from "viem";

import type {
  EntityField,
  EntityNodeMode,
  ExpirationDuration,
  IndexedAttributeType,
  PersistedEntitySnapshot,
  SystemAttribute,
} from "@/lib/arkiv/types";

export type EntityNodeData = {
  mode: EntityNodeMode;
  label: string;
  expirationDuration: ExpirationDuration;
  fields: EntityField[];
  entityKey?: Hex;
  explorerUrl?: string;
  systemAttributes?: SystemAttribute[];
  confirmedExpirationBlock?: string;
};

export type SchemaNode = Node<EntityNodeData, "entity">;
export type SchemaEdge = Edge;

type SchemaState = {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  activeNodeId?: string;
  onNodesChange: (changes: NodeChange<SchemaNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<SchemaEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addDraftEntity: () => void;
  resetToSingleDraft: () => void;
  setActiveNode: (nodeId: string) => void;
  getActiveNode: () => SchemaNode | undefined;
  openPersistedEntity: (snapshot: PersistedEntitySnapshot & {
    expirationDuration: ExpirationDuration;
  }) => void;
  replaceNodeWithPersisted: (
    nodeId: string,
    snapshot: PersistedEntitySnapshot & { expirationDuration: ExpirationDuration },
  ) => void;
  updateEntityName: (nodeId: string, name: string) => void;
  updateExpirationDuration: (
    nodeId: string,
    duration: ExpirationDuration,
  ) => void;
  addField: (nodeId: string) => void;
  updateFieldName: (nodeId: string, fieldId: string, name: string) => void;
  updateFieldValue: (nodeId: string, fieldId: string, value: string) => void;
  updateFieldType: (
    nodeId: string,
    fieldId: string,
    type: IndexedAttributeType,
  ) => void;
};

const getEntityPosition = (index: number): XYPosition => {
  const column = index % 3;
  const row = Math.floor(index / 3);

  return {
    x: 96 + column * 420 + (index % 2) * 16,
    y: 140 + row * 260,
  };
};

const createEmptyField = (): EntityField => ({
  id: `field-${crypto.randomUUID()}`,
  name: "",
  type: "indexedString",
  value: "",
});

const createDraftEntityNode = (index: number): SchemaNode => ({
  id: `entity-${crypto.randomUUID()}`,
  type: "entity",
  position: getEntityPosition(index),
  data: {
    mode: "draft",
    label: "",
    expirationDuration: "30d",
    fields: [createEmptyField()],
  },
});

const updateNodeById = (
  nodes: SchemaNode[],
  nodeId: string,
  updater: (node: SchemaNode) => SchemaNode,
) =>
  nodes.map((node) => (node.id === nodeId ? updater(node) : node));

const markSelectedNode = (nodes: SchemaNode[], nodeId: string) =>
  nodes.map((node) => ({
    ...node,
    selected: node.id === nodeId,
  }));

const mapSnapshotToNodeData = (
  snapshot: PersistedEntitySnapshot & { expirationDuration: ExpirationDuration },
): EntityNodeData => ({
  mode: "persisted",
  label: snapshot.label,
  expirationDuration: snapshot.expirationDuration,
  fields: snapshot.fields,
  entityKey: snapshot.entityKey,
  explorerUrl: snapshot.explorerUrl,
  systemAttributes: snapshot.systemAttributes,
  confirmedExpirationBlock: snapshot.confirmedExpirationBlock,
});

export const useSchemaStore = create<SchemaState>((set, get) => ({
  nodes: [{ ...createDraftEntityNode(0), selected: true }],
  edges: [],
  activeNodeId: undefined,
  onNodesChange: (changes) =>
    set((state) => {
      const nodes = applyNodeChanges(changes, state.nodes);
      const selectedNode = nodes.find((node) => node.selected);

      return {
        nodes,
        activeNodeId: selectedNode?.id ?? state.activeNodeId,
      };
    }),
  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),
  onConnect: (connection) =>
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          animated: true,
        },
        state.edges,
      ),
    })),
  addDraftEntity: () =>
    set((state) => {
      const nextNode = { ...createDraftEntityNode(state.nodes.length), selected: true };

      return {
        nodes: [...markSelectedNode(state.nodes, nextNode.id), nextNode],
        activeNodeId: nextNode.id,
      };
    }),
  resetToSingleDraft: () => {
    const nextNode = { ...createDraftEntityNode(0), selected: true };

    set({
      nodes: [nextNode],
      edges: [],
      activeNodeId: nextNode.id,
    });
  },
  setActiveNode: (nodeId) =>
    set((state) => ({
      nodes: markSelectedNode(state.nodes, nodeId),
      activeNodeId: nodeId,
    })),
  getActiveNode: () => {
    const { activeNodeId, nodes } = get();
    return nodes.find((node) => node.id === activeNodeId) ?? nodes[0];
  },
  openPersistedEntity: (snapshot) =>
    set((state) => {
      const existingNode = state.nodes.find(
        (node) => node.data.entityKey === snapshot.entityKey,
      );

      if (existingNode) {
        return {
          nodes: markSelectedNode(
            updateNodeById(state.nodes, existingNode.id, (node) => ({
              ...node,
              data: mapSnapshotToNodeData(snapshot),
            })),
            existingNode.id,
          ),
          activeNodeId: existingNode.id,
        };
      }

      const nextNode: SchemaNode = {
        id: `entity-${crypto.randomUUID()}`,
        type: "entity",
        position: getEntityPosition(state.nodes.length),
        data: mapSnapshotToNodeData(snapshot),
        selected: true,
      };

      return {
        nodes: [...markSelectedNode(state.nodes, nextNode.id), nextNode],
        activeNodeId: nextNode.id,
      };
    }),
  replaceNodeWithPersisted: (nodeId, snapshot) =>
    set((state) => ({
      nodes: markSelectedNode(
        updateNodeById(state.nodes, nodeId, (node) => ({
          ...node,
          data: mapSnapshotToNodeData(snapshot),
        })),
        nodeId,
      ),
      activeNodeId: nodeId,
    })),
  updateEntityName: (nodeId, name) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          label: name,
        },
      })),
    })),
  updateExpirationDuration: (nodeId, duration) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          expirationDuration: duration,
        },
      })),
    })),
  addField: (nodeId) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          fields: [...node.data.fields, createEmptyField()],
        },
      })),
    })),
  updateFieldName: (nodeId, fieldId, name) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          fields: node.data.fields.map((field) =>
            field.id === fieldId ? { ...field, name } : field,
          ),
        },
      })),
    })),
  updateFieldValue: (nodeId, fieldId, value) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          fields: node.data.fields.map((field) =>
            field.id === fieldId ? { ...field, value } : field,
          ),
        },
      })),
    })),
  updateFieldType: (nodeId, fieldId, type) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          fields: node.data.fields.map((field) =>
            field.id === fieldId ? { ...field, type } : field,
          ),
        },
      })),
    })),
}));
