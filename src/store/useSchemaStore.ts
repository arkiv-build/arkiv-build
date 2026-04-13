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
  EntityDataField,
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
  dataFields: EntityDataField[];
  entityKey?: Hex;
  explorerUrl?: string;
  systemAttributes?: SystemAttribute[];
  confirmedExpirationBlock?: string;
  entityData?: string;
  entitySize?: number;
  deployFailed?: boolean;
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
  clearCanvas: () => void;
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
  removeField: (nodeId: string, fieldId: string) => void;
  updateFieldName: (nodeId: string, fieldId: string, name: string) => void;
  updateFieldValue: (nodeId: string, fieldId: string, value: string) => void;
  updateFieldType: (
    nodeId: string,
    fieldId: string,
    type: IndexedAttributeType,
  ) => void;
  addDataField: (nodeId: string) => void;
  removeDataField: (nodeId: string, fieldId: string) => void;
  updateDataFieldKey: (nodeId: string, fieldId: string, key: string) => void;
  updateDataFieldValue: (nodeId: string, fieldId: string, value: string) => void;
  updateEntityData: (nodeId: string, entityData: string) => void;
  setDeployFailed: (nodeId: string, failed: boolean) => void;
  removeNode: (nodeId: string) => void;
  loadGraphOfEntities: (nodes: SchemaNode[], edges: SchemaEdge[]) => void;
};

const ENTITY_START_POSITION: XYPosition = { x: 96, y: 140 };
const ENTITY_DEFAULT_WIDTH = 544;
const ENTITY_HORIZONTAL_GAP = 96;

const getNextEntityPosition = (nodes: SchemaNode[]): XYPosition => {
  if (nodes.length === 0) {
    return ENTITY_START_POSITION;
  }

  const topMostY = Math.min(...nodes.map((node) => node.position.y));
  const rightMostX = Math.max(
    ...nodes.map((node) => node.position.x + (node.measured?.width ?? ENTITY_DEFAULT_WIDTH)),
  );

  return {
    x: rightMostX + ENTITY_HORIZONTAL_GAP,
    y: topMostY,
  };
};

const createEmptyField = (): EntityField => ({
  id: `field-${crypto.randomUUID()}`,
  name: "",
  type: "indexedString",
  value: "",
});

const createEmptyDataField = (): EntityDataField => ({
  id: `data-${crypto.randomUUID()}`,
  key: "",
  value: "",
});

const createDraftEntityNode = (position: XYPosition): SchemaNode => ({
  id: `entity-${crypto.randomUUID()}`,
  type: "entity",
  position,
  data: {
    mode: "draft",
    label: "",
    expirationDuration: "30d",
    fields: [createEmptyField()],
    dataFields: [createEmptyDataField()],
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

export const mapSnapshotToNodeData = (
  snapshot: PersistedEntitySnapshot & { expirationDuration: ExpirationDuration },
): EntityNodeData => ({
  mode: "persisted",
  label: snapshot.label,
  expirationDuration: snapshot.expirationDuration,
  fields: snapshot.fields,
  dataFields: [],
  entityKey: snapshot.entityKey,
  explorerUrl: snapshot.explorerUrl,
  systemAttributes: snapshot.systemAttributes,
  confirmedExpirationBlock: snapshot.confirmedExpirationBlock,
  entityData: snapshot.entityData,
  entitySize: snapshot.entitySize,
});

export const useSchemaStore = create<SchemaState>((set, get) => ({
  nodes: [{ ...createDraftEntityNode(ENTITY_START_POSITION), selected: true }],
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
    set((state) => {
      const edges = applyEdgeChanges(changes, state.edges);
      
      const removedEdgeIds = changes
        .filter((c) => c.type === "remove")
        .map((c) => c.id);

      let nodes = state.nodes;
      if (removedEdgeIds.length > 0) {
        nodes = nodes.map((node) => {
          const hasEdgeField = node.data.fields.some(
            (f) => f.edgeId && removedEdgeIds.includes(f.edgeId)
          );
          if (!hasEdgeField) return node;
          return {
            ...node,
            data: {
              ...node.data,
              fields: node.data.fields.filter(
                (f) => !f.edgeId || !removedEdgeIds.includes(f.edgeId)
              ),
            },
          };
        });
      }

      return { edges, nodes };
    }),
  onConnect: (connection) =>
    set((state) => {
      const edgeId = `xy-edge__${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`;
      const newEdge: SchemaEdge = {
        ...connection,
        id: edgeId,
        animated: true,
      };

      const edges = addEdge(newEdge, state.edges);

      const sourceNode = state.nodes.find((n) => n.id === connection.source);
      const targetNode = state.nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return { edges };

      let sourceLabelRaw = sourceNode.data.label || "entity";
      if (sourceLabelRaw.startsWith("0x") && sourceLabelRaw.includes("...")) {
        sourceLabelRaw = "parent";
      }

      const sourceLabel =
        sourceLabelRaw.charAt(0).toLowerCase() + sourceLabelRaw.slice(1);

      const newField: EntityField = {
        id: `field-${crypto.randomUUID()}`,
        name: `${sourceLabel}Id`,
        type: "indexedString",
        value: sourceNode.data.entityKey || "",
        edgeId: newEdge.id,
        relationNodeId: sourceNode.id,
      };

      const nodes = updateNodeById(state.nodes, targetNode.id, (node) => ({
        ...node,
        data: {
          ...node.data,
          fields: [...node.data.fields, newField],
        },
      }));

      return { edges, nodes };
    }),
  addDraftEntity: () =>
    set((state) => {
      const nextNode = {
        ...createDraftEntityNode(getNextEntityPosition(state.nodes)),
        selected: true,
      };

      return {
        nodes: [...markSelectedNode(state.nodes, nextNode.id), nextNode],
        activeNodeId: nextNode.id,
      };
    }),
  resetToSingleDraft: () => {
    const nextNode = { ...createDraftEntityNode(ENTITY_START_POSITION), selected: true };

    set({
      nodes: [nextNode],
      edges: [],
      activeNodeId: nextNode.id,
    });
  },
  clearCanvas: () => {
    set({
      nodes: [],
      edges: [],
      activeNodeId: undefined,
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
        position: getNextEntityPosition(state.nodes),
        data: mapSnapshotToNodeData(snapshot),
        selected: true,
      };

      return {
        nodes: [...markSelectedNode(state.nodes, nextNode.id), nextNode],
        activeNodeId: nextNode.id,
      };
    }),
  replaceNodeWithPersisted: (nodeId, snapshot) =>
    set((state) => {
      let nodes = updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: mapSnapshotToNodeData(snapshot),
      }));

      nodes = nodes.map((node) => {
        let modified = false;
        const newFields = node.data.fields.map((field) => {
          if (field.relationNodeId === nodeId && !field.value) {
            modified = true;
            return { ...field, value: snapshot.entityKey };
          }
          return field;
        });
        if (modified) {
          return { ...node, data: { ...node.data, fields: newFields } };
        }
        return node;
      });

      return {
        nodes: markSelectedNode(nodes, nodeId),
        activeNodeId: nodeId,
      };
    }),
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
  removeField: (nodeId, fieldId) =>
    set((state) => {
      const node = state.nodes.find((n) => n.id === nodeId);
      const field = node?.data.fields.find((f) => f.id === fieldId);
      
      let edges = state.edges;
      if (field?.edgeId) {
        edges = edges.filter((e) => e.id !== field.edgeId);
      }

      return {
        nodes: updateNodeById(state.nodes, nodeId, (node) => ({
          ...node,
          data: {
            ...node.data,
            fields: node.data.fields.filter((field) => field.id !== fieldId),
          },
        })),
        edges,
      };
    }),
  addDataField: (nodeId) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          dataFields: [...(node.data.dataFields ?? []), createEmptyDataField()],
        },
      })),
    })),
  removeDataField: (nodeId, fieldId) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          dataFields: (node.data.dataFields ?? []).filter((f) => f.id !== fieldId),
        },
      })),
    })),
  updateDataFieldKey: (nodeId, fieldId, key) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          dataFields: (node.data.dataFields ?? []).map((f) =>
            f.id === fieldId ? { ...f, key } : f,
          ),
        },
      })),
    })),
  updateDataFieldValue: (nodeId, fieldId, value) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          dataFields: (node.data.dataFields ?? []).map((f) =>
            f.id === fieldId ? { ...f, value } : f,
          ),
        },
      })),
    })),
  updateEntityData: (nodeId, entityData) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          entityData,
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
  removeNode: (nodeId) =>
    set((state) => {
      let nodes = state.nodes.filter((node) => node.id !== nodeId);
      
      nodes = nodes.map((node) => {
        const hasDanglingRelation = node.data.fields.some(
          (f) => f.relationNodeId === nodeId,
        );
        if (!hasDanglingRelation) return node;
        return {
          ...node,
          data: {
            ...node.data,
            fields: node.data.fields.filter((f) => f.relationNodeId !== nodeId),
          },
        };
      });

      return {
        nodes,
        edges: state.edges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
        activeNodeId:
          state.activeNodeId === nodeId
            ? nodes[nodes.length - 1]?.id
            : state.activeNodeId,
      };
    }),
  setDeployFailed: (nodeId, failed) =>
    set((state) => ({
      nodes: updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          deployFailed: failed,
        },
      })),
    })),
  loadGraphOfEntities: (nodes, edges) =>
    set({
      nodes,
      edges,
      activeNodeId: nodes.find((n) => n.selected)?.id ?? nodes[0]?.id,
    }),
}));
