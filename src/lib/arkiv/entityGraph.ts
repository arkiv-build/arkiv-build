import type { Hex } from 'viem'

import type {
  EntityField,
  ExpirationDuration,
  OwnedArkivEntitySummary,
  PersistedEntitySnapshot,
} from '@/lib/arkiv/types'
import type { EntityNodeData, SchemaEdge, SchemaNode } from '@/store/useSchemaStore'

const ENTITY_START_X = 96
const ENTITY_START_Y = 140
const ENTITY_HORIZONTAL_GAP = 600
const ENTITY_VERTICAL_GAP = 300

export type PersistedEntityGraphSnapshot = PersistedEntitySnapshot & {
  expirationDuration: ExpirationDuration
}

type EntityGraphNode = {
  snapshot: PersistedEntityGraphSnapshot
  parentKeys: Hex[]
  level: number
}

const isEntityKey = (value: string): value is Hex =>
  value.startsWith('0x') && value.length === 66

export const mapSnapshotToNodeData = (
  snapshot: PersistedEntityGraphSnapshot,
): EntityNodeData => ({
  mode: 'persisted',
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
})

export const findConnectedEntityKeys = (
  entityKey: Hex,
  ownedEntities: OwnedArkivEntitySummary[],
) => {
  const connectedKeys = new Set<Hex>()
  const queue = [entityKey]
  const ownedKeys = new Set(ownedEntities.map((entity) => entity.key))

  while (queue.length > 0) {
    const currentKey = queue.shift()
    if (!currentKey || connectedKeys.has(currentKey)) {
      continue
    }

    connectedKeys.add(currentKey)

    const summary = ownedEntities.find((entity) => entity.key === currentKey)
    if (!summary) {
      continue
    }

    const parentKeys = (summary.fields ?? [])
      .map((field) => field.value)
      .filter((value): value is Hex => isEntityKey(value) && ownedKeys.has(value))

    const downstreamKeys = ownedEntities
      .filter((entity) =>
        (entity.fields ?? []).some((field) => field.value === currentKey),
      )
      .map((entity) => entity.key)

    for (const key of [...parentKeys, ...downstreamKeys]) {
      if (!connectedKeys.has(key)) {
        queue.push(key)
      }
    }
  }

  return connectedKeys
}

export const buildEntityGraphLayout = (
  snapshots: PersistedEntityGraphSnapshot[],
  connectedKeys: Set<Hex>,
) => {
  const nodesMap = new Map<Hex, EntityGraphNode>()

  for (const snapshot of snapshots) {
    const parentKeys = snapshot.fields
      .map((field) => field.value)
      .filter((value): value is Hex => isEntityKey(value) && connectedKeys.has(value))

    nodesMap.set(snapshot.entityKey, {
      snapshot,
      parentKeys,
      level: 0,
    })
  }

  let changed = true
  let iterations = 0

  while (changed && iterations < 100) {
    changed = false

    for (const node of nodesMap.values()) {
      const maxParentLevel =
        node.parentKeys.length > 0
          ? Math.max(
              ...node.parentKeys.map((parentKey) => nodesMap.get(parentKey)?.level ?? 0),
            )
          : -1

      if (node.level !== maxParentLevel + 1) {
        node.level = maxParentLevel + 1
        changed = true
      }
    }

    iterations += 1
  }

  const levelGroups = new Map<number, Hex[]>()

  for (const [key, node] of nodesMap.entries()) {
    if (!levelGroups.has(node.level)) {
      levelGroups.set(node.level, [])
    }

    levelGroups.get(node.level)?.push(key)
  }

  return {
    nodesMap,
    levelGroups,
  }
}

const createUniquePersistedEdgeId = (
  sourceId: string,
  targetId: string,
  fieldName: string,
  seenEdgeIds: Set<string>,
) => {
  const edgeBaseId = `xy-edge__${sourceId}-null-${targetId}-null-${fieldName}`
  let edgeId = edgeBaseId
  let duplicateIndex = 2

  while (seenEdgeIds.has(edgeId)) {
    edgeId = `${edgeBaseId}-${duplicateIndex}`
    duplicateIndex += 1
  }

  seenEdgeIds.add(edgeId)
  return edgeId
}

const decorateRelationFields = ({
  snapshot,
  nodesMap,
  seenEdgeIds,
}: {
  snapshot: PersistedEntityGraphSnapshot
  nodesMap: Map<Hex, EntityGraphNode>
  seenEdgeIds: Set<string>
}) => {
  const targetId = `entity-${snapshot.entityKey}`
  const fields: EntityField[] = snapshot.fields.map((field) => {
    const relationKey = field.value

    if (!isEntityKey(relationKey) || !nodesMap.has(relationKey)) {
      return field
    }

    if (relationKey === snapshot.entityKey) {
      return {
        ...field,
        edgeId: undefined,
        relationNodeId: undefined,
      }
    }

    const sourceId = `entity-${relationKey}`
    const edgeId = createUniquePersistedEdgeId(
      sourceId,
      targetId,
      field.name,
      seenEdgeIds,
    )

    return {
      ...field,
      edgeId,
      relationNodeId: sourceId,
    }
  })

  return fields
}

export const buildCanvasGraphFromSnapshots = ({
  snapshots,
  selectedEntityKey,
}: {
  snapshots: PersistedEntityGraphSnapshot[]
  selectedEntityKey: Hex
}): { nodes: SchemaNode[]; edges: SchemaEdge[] } => {
  const connectedKeys = new Set(snapshots.map((snapshot) => snapshot.entityKey))
  const { nodesMap, levelGroups } = buildEntityGraphLayout(snapshots, connectedKeys)
  const seenEdgeIds = new Set<string>()

  const decoratedFieldsByKey = new Map<Hex, EntityField[]>()
  const edges: SchemaEdge[] = []

  for (const node of nodesMap.values()) {
    const fields = decorateRelationFields({
      snapshot: node.snapshot,
      nodesMap,
      seenEdgeIds,
    })

    decoratedFieldsByKey.set(node.snapshot.entityKey, fields)

    for (const field of fields) {
      if (!field.edgeId || !field.relationNodeId) {
        continue
      }

      edges.push({
        id: field.edgeId,
        source: field.relationNodeId,
        target: `entity-${node.snapshot.entityKey}`,
        sourceHandle: undefined,
        targetHandle: undefined,
        animated: true,
      })
    }
  }

  const nodes: SchemaNode[] = []

  for (const [level, keys] of levelGroups.entries()) {
    keys.forEach((key, index) => {
      const nodeInfo = nodesMap.get(key)
      if (!nodeInfo) {
        return
      }

      nodes.push({
        id: `entity-${key}`,
        type: 'entity',
        position: {
          x: ENTITY_START_X + level * ENTITY_HORIZONTAL_GAP,
          y: ENTITY_START_Y + index * ENTITY_VERTICAL_GAP,
        },
        data: {
          ...mapSnapshotToNodeData(nodeInfo.snapshot),
          fields: decoratedFieldsByKey.get(key) ?? nodeInfo.snapshot.fields,
        },
        selected: key === selectedEntityKey,
      })
    })
  }

  return { nodes, edges }
}
