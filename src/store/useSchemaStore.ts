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

export const MOCK_CURRENT_BLOCK = 18_420_000;
export const BLOCKS_PER_DAY = 7_200;

export const EXPIRATION_DURATION_OPTIONS = ["7d", "30d", "90d", "365d"] as const;

export type ExpirationDuration = (typeof EXPIRATION_DURATION_OPTIONS)[number];
export type IndexedAttributeType = "indexedString" | "indexedNumber";

export type EntityColumn = {
  id: string;
  name: string;
  type: IndexedAttributeType;
};

export type EntityNodeData = {
  label: string;
  expirationDuration: ExpirationDuration;
  columns: EntityColumn[];
};

export type SystemAttribute = {
  name: "$key" | "$creator" | "$owner" | "$expiration" | "$createdAtBlock";
  value: string;
};

export type SchemaNode = Node<EntityNodeData, "entity">;
export type SchemaEdge = Edge;

type SchemaState = {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  onNodesChange: (changes: NodeChange<SchemaNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<SchemaEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addEntity: () => void;
  updateEntityName: (nodeId: string, name: string) => void;
  updateExpirationDuration: (
    nodeId: string,
    duration: ExpirationDuration,
  ) => void;
  addField: (nodeId: string) => void;
  updateFieldName: (nodeId: string, fieldId: string, name: string) => void;
  updateFieldType: (
    nodeId: string,
    fieldId: string,
    type: IndexedAttributeType,
  ) => void;
};

const DEFAULT_COLUMNS: EntityColumn[] = [
  { id: "field-category", name: "category", type: "indexedString" },
  { id: "field-priority", name: "priority", type: "indexedNumber" },
  { id: "field-project-ref", name: "project_ref", type: "indexedString" },
  { id: "field-timestamp", name: "timestamp", type: "indexedNumber" },
];

const durationToDays: Record<ExpirationDuration, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export const getExpirationBlock = (duration: ExpirationDuration) =>
  MOCK_CURRENT_BLOCK + durationToDays[duration] * BLOCKS_PER_DAY;

export const formatBlockNumber = (value: number) => value.toLocaleString("en-US");

export const getArkivSystemAttributes = (
  duration: ExpirationDuration,
): SystemAttribute[] => [
  { name: "$key", value: "0x7fa3c2e9b11d4a8f" },
  {
    name: "$creator",
    value: "0x4f3ad7b29c91e8aa12d4f0c6b1e39b7a8c4d9e21",
  },
  {
    name: "$owner",
    value: "0x91bc44e2f6d13a7098ef2c3ab8c741de55f0a612",
  },
  {
    name: "$expiration",
    value: formatBlockNumber(getExpirationBlock(duration)),
  },
  {
    name: "$createdAtBlock",
    value: formatBlockNumber(MOCK_CURRENT_BLOCK),
  },
];

const getEntityPosition = (index: number): XYPosition => {
  const column = index % 3;
  const row = Math.floor(index / 3);

  return {
    x: 96 + column * 320 + (index % 2) * 16,
    y: 120 + row * 220,
  };
};

const createEntityNode = (index: number): SchemaNode => ({
  id: `entity-${crypto.randomUUID()}`,
  type: "entity",
  position: getEntityPosition(index),
  data: {
    label: index === 0 ? "New_Entity" : `New_Entity_${index + 1}`,
    expirationDuration: "30d",
    columns: DEFAULT_COLUMNS.map((column) => ({
      ...column,
      id: `${column.id}-${crypto.randomUUID()}`,
    })),
  },
});

const updateNodeById = (
  nodes: SchemaNode[],
  nodeId: string,
  updater: (node: SchemaNode) => SchemaNode,
) =>
  nodes.map((node) => (node.id === nodeId ? updater(node) : node));

export const useSchemaStore = create<SchemaState>((set) => ({
  nodes: [createEntityNode(0)],
  edges: [],
  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    })),
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
  addEntity: () =>
    set((state) => ({
      nodes: [...state.nodes, createEntityNode(state.nodes.length)],
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
          columns: [
            ...node.data.columns,
            {
              id: `field-${crypto.randomUUID()}`,
              name: `field_${node.data.columns.length + 1}`,
              type: "indexedString",
            },
          ],
        },
      })),
    })),
  updateFieldName: (nodeId, fieldId, name) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          columns: node.data.columns.map((column) =>
            column.id === fieldId ? { ...column, name } : column,
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
          columns: node.data.columns.map((column) =>
            column.id === fieldId ? { ...column, type } : column,
          ),
        },
      })),
    })),
}));
