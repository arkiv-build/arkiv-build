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
import type { GeneratedDataModel } from "@/lib/ai/dataModel";
import { mapSnapshotToNodeData } from "@/lib/arkiv/entityGraph";
import {
  SCHEMA_DATA_FIELD_ID_PREFIX,
  SCHEMA_DEFAULT_EXPIRATION_DURATION,
  SCHEMA_EDGE_ID_PREFIX,
  SCHEMA_ENTITY_NODE_WIDTH,
  SCHEMA_ENTITY_START_POSITION,
  SCHEMA_FIELD_ID_PREFIX,
  SCHEMA_NODE_ID_PREFIX,
} from '@/lib/constants/schema'

export type EntityNodeData = {
  mode: EntityNodeMode;
  label: string;
  projectAttributeValue?: string;
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

export type SeedGenerationContext = {
  generatedAt: string;
  entityCount: number;
  source: "ai";
};

export type BatchDeploymentContext = {
  deployedAt: string;
  txHash: string;
  entityCount: number;
  createdEntityKeys: string[];
  usedGeneratedSeedValues: boolean;
  note?: string;
};

type SchemaState = {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  deploymentNotes: string[];
  seedGenerationContext?: SeedGenerationContext;
  batchDeploymentContext?: BatchDeploymentContext;
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
  updateEntityName: (nodeId: string, name: string, walletAddress?: string) => void;
  setProjectAttributeForConnectedDrafts: (
    nodeId: string,
    projectAttributeValue: string,
  ) => void;
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
  applyGeneratedSeedValues: (model: GeneratedDataModel) => void;
  setBatchDeploymentContext: (context: BatchDeploymentContext) => void;
  replaceDraftNodesWithPersistedBatch: (
    snapshotsByNodeId: Record<string, PersistedEntitySnapshot & { expirationDuration: ExpirationDuration }>,
  ) => void;
  removeNode: (nodeId: string) => void;
  loadGraphOfEntities: (
    nodes: SchemaNode[],
    edges: SchemaEdge[],
    deploymentNotes?: string[],
  ) => void;
  mergeGraphOfEntities: (nodes: SchemaNode[], edges: SchemaEdge[]) => void;
};

const ENTITY_HORIZONTAL_GAP = 96;
const PROJECT_ATTRIBUTE_KEY = "project";
const LEGACY_PROJECT_ATTRIBUTE_KEY = "PROJECT_ATTRIBUTE";
const WALLET_PREFIX_PATTERN = /^(0x[a-fA-F0-9]{40})(-.+)?$/;

const getNextEntityPosition = (nodes: SchemaNode[]): XYPosition => {
  if (nodes.length === 0) {
    return SCHEMA_ENTITY_START_POSITION;
  }

  const topMostY = Math.min(...nodes.map((node) => node.position.y));
  const rightMostX = Math.max(
    ...nodes.map((node) => node.position.x + (node.measured?.width ?? SCHEMA_ENTITY_NODE_WIDTH)),
  );

  return {
    x: rightMostX + ENTITY_HORIZONTAL_GAP,
    y: topMostY,
  };
};

const createEmptyField = (): EntityField => ({
  id: `${SCHEMA_FIELD_ID_PREFIX}${crypto.randomUUID()}`,
  name: "",
  type: "indexedString",
  value: "",
});

const formatProjectAttributeLabel = (projectAttributeValue: string) => {
  const trimmedValue = projectAttributeValue.trim();
  const match = trimmedValue.match(WALLET_PREFIX_PATTERN);

  if (!match) {
    return trimmedValue;
  }

  const [, walletAddress, suffix = ""] = match;
  return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}${suffix}`;
};

const upsertProjectAttributeField = (
  fields: EntityField[],
  projectAttributeValue: string,
): EntityField[] => {
  const projectAttributeIndex = fields.findIndex(
    (field) =>
      field.name === LEGACY_PROJECT_ATTRIBUTE_KEY || field.name.toLowerCase() === PROJECT_ATTRIBUTE_KEY,
  );

  if (projectAttributeIndex >= 0) {
    return fields.map((field, index) =>
      index === projectAttributeIndex
        ? {
            ...field,
            name: PROJECT_ATTRIBUTE_KEY,
            type: "indexedString" as const,
            value: projectAttributeValue,
          }
        : field,
    );
  }

  const emptyFieldIndex = fields.findIndex(
    (field) => !field.edgeId && !field.name.trim() && !field.value.trim(),
  );

  if (emptyFieldIndex >= 0) {
    return fields.map((field, index) =>
      index === emptyFieldIndex
        ? {
            ...field,
            name: PROJECT_ATTRIBUTE_KEY,
            type: "indexedString" as const,
            value: projectAttributeValue,
          }
        : field,
    );
  }

  return [
    {
      id: `${SCHEMA_FIELD_ID_PREFIX}${crypto.randomUUID()}`,
      name: PROJECT_ATTRIBUTE_KEY,
      type: "indexedString" as const,
      value: projectAttributeValue,
    },
    ...fields,
  ];
};

const createEmptyDataField = (): EntityDataField => ({
  id: `${SCHEMA_DATA_FIELD_ID_PREFIX}${crypto.randomUUID()}`,
  key: "",
  value: "",
});

const createDraftEntityNode = (position: XYPosition): SchemaNode => ({
  id: `${SCHEMA_NODE_ID_PREFIX}${crypto.randomUUID()}`,
  type: "entity",
  position,
  data: {
    mode: "draft",
    label: "",
    expirationDuration: SCHEMA_DEFAULT_EXPIRATION_DURATION,
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

const createProjectAttributeValue = (_walletAddress: string | undefined, name: string) => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return undefined;
  }

  return trimmedName;
};

const findConnectedNodeIds = (
  nodeId: string,
  edges: SchemaEdge[],
) => {
  const connectedNodeIds = new Set([nodeId]);
  let changed = true;

  while (changed) {
    changed = false;

    edges.forEach((edge) => {
      const sourceConnected = connectedNodeIds.has(edge.source);
      const targetConnected = connectedNodeIds.has(edge.target);

      if (sourceConnected && !targetConnected) {
        connectedNodeIds.add(edge.target);
        changed = true;
      }

      if (targetConnected && !sourceConnected) {
        connectedNodeIds.add(edge.source);
        changed = true;
      }
    });
  }

  return connectedNodeIds;
};

const applyProjectAttributeToConnectedNodes = (
  nodes: SchemaNode[],
  edges: SchemaEdge[],
  nodeId: string,
  projectAttributeValue: string | undefined,
  syncLabel = false,
) => {
  if (projectAttributeValue === undefined) {
    return nodes;
  }

  const connectedNodeIds = findConnectedNodeIds(nodeId, edges);

  return nodes.map((node) =>
    connectedNodeIds.has(node.id) && node.data.mode === "draft"
      ? {
          ...node,
          data: {
            ...node.data,
            label:
              syncLabel && projectAttributeValue
                ? formatProjectAttributeLabel(projectAttributeValue)
                : node.data.label,
            projectAttributeValue,
            fields: upsertProjectAttributeField(node.data.fields, projectAttributeValue),
          },
        }
      : node,
  );
};

const isProjectAttributeField = (field: EntityField) => {
  const name = field.name.trim();
  return name === LEGACY_PROJECT_ATTRIBUTE_KEY || name.toLowerCase() === PROJECT_ATTRIBUTE_KEY;
};

export const useSchemaStore = create<SchemaState>((set, get) => ({
  nodes: [{ ...createDraftEntityNode(SCHEMA_ENTITY_START_POSITION), selected: true }],
  edges: [],
  deploymentNotes: [],
  seedGenerationContext: undefined,
  batchDeploymentContext: undefined,
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
      const edgeId = `${SCHEMA_EDGE_ID_PREFIX}${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`;
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
        id: `${SCHEMA_FIELD_ID_PREFIX}${crypto.randomUUID()}`,
        name: `${sourceLabel}Id`,
        type: "indexedString",
        value: sourceNode.data.entityKey || "",
        edgeId: newEdge.id,
        relationNodeId: sourceNode.id,
      };

      const projectAttributeValue = sourceNode.data.projectAttributeValue;

      const nodesWithRelation = updateNodeById(state.nodes, targetNode.id, (node) => ({
        ...node,
        data: {
          ...node.data,
          fields: [...node.data.fields, newField],
        },
      }));
      const nodes = applyProjectAttributeToConnectedNodes(
        nodesWithRelation,
        edges,
        targetNode.id,
        projectAttributeValue,
        true,
      );

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
    const nextNode = { ...createDraftEntityNode(SCHEMA_ENTITY_START_POSITION), selected: true };

    set({
      nodes: [nextNode],
      edges: [],
      seedGenerationContext: undefined,
      batchDeploymentContext: undefined,
      activeNodeId: nextNode.id,
    });
  },
  clearCanvas: () => {
    set({
      nodes: [],
      edges: [],
      deploymentNotes: [],
      seedGenerationContext: undefined,
      batchDeploymentContext: undefined,
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
        id: `${SCHEMA_NODE_ID_PREFIX}${crypto.randomUUID()}`,
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
  updateEntityName: (nodeId, name, walletAddress) =>
    set((state) => {
      const projectAttributeValue = createProjectAttributeValue(walletAddress, name);
      const nodesWithName = updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          label: name,
          projectAttributeValue: projectAttributeValue ?? node.data.projectAttributeValue,
        },
      }));

      return {
        nodes: applyProjectAttributeToConnectedNodes(
          nodesWithName,
          state.edges,
          nodeId,
          projectAttributeValue,
        ),
      };
    }),
  setProjectAttributeForConnectedDrafts: (nodeId, projectAttributeValue) =>
    set((state) => ({
      nodes: applyProjectAttributeToConnectedNodes(
        state.nodes,
        state.edges,
        nodeId,
        projectAttributeValue,
      ),
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
    set((state) => {
      const sourceNode = state.nodes.find((n) => n.id === nodeId);
      const targetField = sourceNode?.data.fields.find((f) => f.id === fieldId);
      const isProjectEdit = !!targetField && isProjectAttributeField(targetField);

      const nodesWithValue = updateNodeById(state.nodes, nodeId, (node) => ({
        ...node,
        data: {
          ...node.data,
          projectAttributeValue: isProjectEdit ? value : node.data.projectAttributeValue,
          fields: node.data.fields.map((field) =>
            field.id === fieldId ? { ...field, value } : field,
          ),
        },
      }));

      if (!isProjectEdit) {
        return { nodes: nodesWithValue };
      }

      return {
        nodes: applyProjectAttributeToConnectedNodes(
          nodesWithValue,
          state.edges,
          nodeId,
          value,
        ),
      };
    }),
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
  applyGeneratedSeedValues: (model) =>
    set((state) => {
      const entityByName = new Map(
        model.entities.map((entity) => [entity.name.trim().toLowerCase(), entity]),
      );

      const nodes = state.nodes.map((node) => {
        if (node.data.mode !== "draft") {
          return node;
        }

        const generatedEntity = entityByName.get(node.data.label.trim().toLowerCase());
        if (!generatedEntity) {
          return node;
        }

        const attributesByName = new Map(
          generatedEntity.indexedAttributes.map((attribute) => [
            attribute.name.trim().toLowerCase(),
            attribute,
          ]),
        );
        const dataFieldsByKey = new Map(
          generatedEntity.dataFields.map((field) => [
            field.key.trim().toLowerCase(),
            field,
          ]),
        );

        return {
          ...node,
          data: {
            ...node.data,
            fields: node.data.fields.map((field) => {
              const attribute = attributesByName.get(field.name.trim().toLowerCase());

              if (!attribute) {
                return field;
              }

              return {
                ...field,
                type: attribute.type,
                value: field.edgeId ? "" : String(attribute.value ?? ""),
              };
            }),
            dataFields: (node.data.dataFields ?? []).map((field) => {
              const generatedField = dataFieldsByKey.get(field.key.trim().toLowerCase());

              if (!generatedField) {
                return field;
              }

              return {
                ...field,
                value: generatedField.value,
              };
            }),
          },
        };
      });

      return {
        nodes,
        seedGenerationContext: {
          generatedAt: new Date().toISOString(),
          entityCount: model.entities.length,
          source: "ai",
        },
        batchDeploymentContext: undefined,
      };
    }),
  setBatchDeploymentContext: (context) =>
    set({
      batchDeploymentContext: context,
    }),
  replaceDraftNodesWithPersistedBatch: (snapshotsByNodeId) =>
    set((state) => {
      const nodes = state.nodes.map((node) => {
        const snapshot = snapshotsByNodeId[node.id];

        if (!snapshot) {
          return node;
        }

        const previousFields = new Map(
          node.data.fields.map((field) => [field.name.trim().toLowerCase(), field]),
        );
        const nextData = mapSnapshotToNodeData(snapshot);

        return {
          ...node,
          data: {
            ...nextData,
            fields: nextData.fields.map((field) => {
              const previousField = previousFields.get(field.name.trim().toLowerCase());

              if (!previousField) {
                return field;
              }

              return {
                ...field,
                edgeId: previousField.edgeId,
                relationNodeId: previousField.relationNodeId,
              };
            }),
          },
        };
      });

      return {
        nodes,
        activeNodeId: Object.keys(snapshotsByNodeId)[0] ?? state.activeNodeId,
      };
    }),
  loadGraphOfEntities: (nodes, edges, deploymentNotes) =>
    set({
      nodes,
      edges,
      deploymentNotes: deploymentNotes ?? [],
      seedGenerationContext: undefined,
      batchDeploymentContext: undefined,
      activeNodeId: nodes.find((n) => n.selected)?.id ?? nodes[0]?.id,
    }),
  mergeGraphOfEntities: (nodes, edges) =>
    set((state) => {
      const existingNodeIds = new Set(state.nodes.map((node) => node.id));
      const existingEdgeIds = new Set(state.edges.map((edge) => edge.id));
      const nextNodes = nodes.filter((node) => !existingNodeIds.has(node.id));
      const nextNodeIds = new Set(nextNodes.map((node) => node.id));

      if (nextNodes.length === 0) {
        return {
          activeNodeId: state.activeNodeId,
        };
      }

      const rightMostX =
        state.nodes.length > 0
          ? Math.max(
              ...state.nodes.map(
                (node) => node.position.x + (node.measured?.width ?? SCHEMA_ENTITY_NODE_WIDTH),
              ),
            )
          : SCHEMA_ENTITY_START_POSITION.x;
      const leftMostIncomingX = Math.min(...nextNodes.map((node) => node.position.x));
      const xOffset = rightMostX + ENTITY_HORIZONTAL_GAP - leftMostIncomingX;
      const selectedNode = nextNodes.find((node) => node.selected) ?? nextNodes[0];

      return {
        nodes: [
          ...state.nodes.map((node) => ({ ...node, selected: false })),
          ...nextNodes.map((node) => ({
            ...node,
            position: {
              x: node.position.x + xOffset,
              y: node.position.y,
            },
          })),
        ],
        edges: [
          ...state.edges,
          ...edges.filter(
            (edge) =>
              !existingEdgeIds.has(edge.id) &&
              (existingNodeIds.has(edge.source) || nextNodeIds.has(edge.source)) &&
              (existingNodeIds.has(edge.target) || nextNodeIds.has(edge.target)),
          ),
        ],
        activeNodeId: selectedNode.id,
      };
    }),
}));
