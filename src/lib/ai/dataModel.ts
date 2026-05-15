import dagre from 'dagre'
import { MarkerType } from '@xyflow/react'

import type { SchemaEdge, SchemaNode } from '@/store/useSchemaStore'
import { EXPIRATION_DURATION_OPTIONS } from '@/lib/arkiv/types'
import type {
  EntityDataField,
  EntityField,
  ExpirationDuration,
  IndexedAttributeType,
} from '@/lib/arkiv/types'
import {
  SCHEMA_DATA_FIELD_ID_PREFIX,
  SCHEMA_DEFAULT_EXPIRATION_DURATION,
  SCHEMA_EDGE_ID_PREFIX,
  SCHEMA_ENTITY_NODE_WIDTH,
  SCHEMA_ENTITY_START_X,
  SCHEMA_ENTITY_START_Y,
  SCHEMA_FIELD_ID_PREFIX,
  SCHEMA_NODE_ID_PREFIX,
} from '@/lib/constants/schema'
import { sanitizeIdentifier } from '@/lib/arkiv/schema'

const ENTITY_NODE_HEIGHT = 110
const DAGRE_RANK_SEP = 250
const DAGRE_NODE_SEP = 130
const DAGRE_EDGE_SEP = 70
const LAYOUT_VERTICAL_GAP = 210

const RELATION_COLORS = [
  '#ff7a45',
  '#0ea5e9',
  '#10b981',
  '#a855f7',
  '#ec4899',
  '#f59e0b',
  '#14b8a6',
  '#6366f1',
  '#ef4444',
  '#84cc16',
] as const

const PROJECT_ATTRIBUTE_KEY = 'project'
const LEGACY_PROJECT_ATTRIBUTE_KEY = 'PROJECT_ATTRIBUTE'
const ENTITY_TYPE_ATTRIBUTE_KEY = 'entityType'

const toEntityTypeValue = (entityName: string) => {
  const sanitized = sanitizeIdentifier(entityName) || entityName
  return sanitized.charAt(0).toLowerCase() + sanitized.slice(1)
}

const pickRelationColor = (index: number) =>
  RELATION_COLORS[index % RELATION_COLORS.length]

export type GeneratedIndexedAttribute = {
  name: string
  type: IndexedAttributeType
  value: string | number
}

export type GeneratedDataField = {
  key: string
  value: string
}

export type GeneratedEntity = {
  name: string
  expirationDuration: ExpirationDuration
  indexedAttributes: GeneratedIndexedAttribute[]
  dataFields: GeneratedDataField[]
}

export type GeneratedRelation = {
  sourceEntity: string
  targetEntity: string
  fieldName: string
}

export type GeneratedDataModel = {
  title: string
  summary: string
  deploymentOrder: string[]
  deploymentNotes: string[]
  entities: GeneratedEntity[]
  relations: GeneratedRelation[]
}

export type DataModelGenerationMode = 'create' | 'edit'

type NamedGeneratedEntity = GeneratedEntity & {
  schemaName: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const ensureString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

const stringifyScalar = (value: unknown) => {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value ?? '')
}

const ensureStringArray = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => ensureString(item).trim()).filter(Boolean) : []

const ensureExpirationDuration = (value: unknown): ExpirationDuration =>
  typeof value === 'string' && EXPIRATION_DURATION_OPTIONS.includes(value as ExpirationDuration)
    ? (value as ExpirationDuration)
    : SCHEMA_DEFAULT_EXPIRATION_DURATION

const ensureIndexedAttributeType = (value: unknown): IndexedAttributeType =>
  value === 'indexedNumber' ? 'indexedNumber' : 'indexedString'

const normalizeGeneratedEntity = (
  value: unknown,
  index: number,
): GeneratedEntity => {
  if (!isRecord(value)) {
    throw new Error(`Entity ${index + 1} is not an object.`)
  }

  const indexedAttributes = Array.isArray(value.indexedAttributes)
    ? value.indexedAttributes
        .filter(isRecord)
        .map((attribute, attributeIndex) => ({
          name:
            sanitizeIdentifier(ensureString(attribute.name).trim()) ||
            `field_${attributeIndex + 1}`,
          type: ensureIndexedAttributeType(attribute.type),
          value:
            typeof attribute.value === 'number'
              ? attribute.value
              : stringifyScalar(attribute.value).trim(),
        }))
    : []

  const dataFields = Array.isArray(value.dataFields)
    ? value.dataFields
        .filter(isRecord)
        .map((field, fieldIndex) => ({
          key:
            sanitizeIdentifier(ensureString(field.key).trim()) ||
            `data_${fieldIndex + 1}`,
          value: stringifyScalar(field.value),
        }))
    : []

  return {
    name: ensureString(value.name).trim() || `Entity_${index + 1}`,
    expirationDuration: ensureExpirationDuration(value.expirationDuration),
    indexedAttributes,
    dataFields,
  }
}

const normalizeGeneratedRelation = (
  value: unknown,
): GeneratedRelation | null => {
  if (!isRecord(value)) {
    return null
  }

  const sourceEntity = ensureString(value.sourceEntity).trim()
  const targetEntity = ensureString(value.targetEntity).trim()
  const fieldName = sanitizeIdentifier(ensureString(value.fieldName).trim())

  if (!sourceEntity || !targetEntity || !fieldName) {
    return null
  }

  return {
    sourceEntity,
    targetEntity,
    fieldName,
  }
}

export const normalizeGeneratedDataModel = (value: unknown): GeneratedDataModel => {
  if (!isRecord(value)) {
    throw new Error('The AI response was not a JSON object.')
  }

  const entities = Array.isArray(value.entities)
    ? value.entities.map(normalizeGeneratedEntity).filter((entity) => entity.name.trim().length > 0)
    : []

  if (entities.length === 0) {
    throw new Error('The AI response did not include any entities.')
  }

  const relations = Array.isArray(value.relations)
    ? value.relations
        .map(normalizeGeneratedRelation)
        .filter((relation): relation is GeneratedRelation => relation !== null)
    : []

  return {
    title: ensureString(value.title, 'Generated Arkiv data model').trim() || 'Generated Arkiv data model',
    summary:
      ensureString(value.summary).trim() ||
      'Deployment-ready Arkiv draft entities generated from the use case.',
    deploymentOrder: ensureStringArray(value.deploymentOrder),
    deploymentNotes: ensureStringArray(value.deploymentNotes),
    entities,
    relations,
  }
}

const extractEntityDataFields = (node: SchemaNode): GeneratedDataField[] => {
  if (node.data.mode === 'draft') {
    return (node.data.dataFields ?? [])
      .filter((field) => field.key.trim().length > 0 || field.value.trim().length > 0)
      .map((field) => ({
        key: field.key,
        value: field.value,
      }))
  }

  if (!node.data.entityData) {
    return []
  }

  try {
    const parsed = JSON.parse(node.data.entityData) as unknown
    if (!isRecord(parsed)) {
      return [{ key: 'payload', value: node.data.entityData }]
    }

    return Object.entries(parsed).map(([key, value]) => ({
      key,
      value: stringifyScalar(value),
    }))
  } catch {
    return [{ key: 'payload', value: node.data.entityData }]
  }
}

export const hasMeaningfulCanvasModel = (
  nodes: SchemaNode[],
  edges: SchemaEdge[],
) => {
  if (edges.length > 0) {
    return true
  }

  return nodes.some((node) => {
    if (node.data.mode === 'persisted') {
      return true
    }

    const hasLabel = node.data.label.trim().length > 0
    const hasFields = node.data.fields.some(
      (field) => field.name.trim().length > 0 || field.value.trim().length > 0,
    )
    const hasDataFields = (node.data.dataFields ?? []).some(
      (field) => field.key.trim().length > 0 || field.value.trim().length > 0,
    )

    return hasLabel || hasFields || hasDataFields
  })
}

export const serializeCanvasToGeneratedDataModel = (
  nodes: SchemaNode[],
  edges: SchemaEdge[],
  deploymentNotes: string[] = [],
): GeneratedDataModel => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const relations = edges
    .map((edge) => {
      const sourceNode = nodeById.get(edge.source)
      const targetNode = nodeById.get(edge.target)

      if (!sourceNode || !targetNode) {
        return null
      }

      const relationField = targetNode.data.fields.find((field) => field.edgeId === edge.id)

      return {
        sourceEntity: sourceNode.data.label || sourceNode.id,
        targetEntity: targetNode.data.label || targetNode.id,
        fieldName:
          relationField?.name ||
          `${sanitizeIdentifier(sourceNode.data.label || 'parent').toLowerCase()}Id`,
      }
    })
    .filter((relation): relation is GeneratedRelation => relation !== null)

  const entities = nodes.map((node, index) => {
    const indexedAttributes = node.data.fields.map((field) => ({
      name: field.name,
      type: field.type,
      value:
        field.type === 'indexedNumber' && Number.isFinite(Number(field.value))
          ? Number(field.value)
          : field.value,
    }))

    if (
      node.data.projectAttributeValue &&
      !indexedAttributes.some(
        (attribute) =>
          attribute.name === LEGACY_PROJECT_ATTRIBUTE_KEY ||
          attribute.name.toLowerCase() === PROJECT_ATTRIBUTE_KEY,
      )
    ) {
      indexedAttributes.unshift({
        name: PROJECT_ATTRIBUTE_KEY,
        type: 'indexedString',
        value: node.data.projectAttributeValue,
      })
    }

    if (
      !indexedAttributes.some(
        (attribute) => attribute.name.trim() === ENTITY_TYPE_ATTRIBUTE_KEY,
      )
    ) {
      indexedAttributes.splice(node.data.projectAttributeValue ? 1 : 0, 0, {
        name: ENTITY_TYPE_ATTRIBUTE_KEY,
        type: 'indexedString',
        value: toEntityTypeValue(node.data.label.trim() || `Entity_${index + 1}`),
      })
    }

    return {
      name: node.data.label.trim() || `Entity_${index + 1}`,
      expirationDuration: node.data.expirationDuration,
      indexedAttributes,
      dataFields: extractEntityDataFields(node),
    }
  })

  return {
    title: 'Current canvas model',
    summary: 'The current Arkiv model already on the canvas.',
    deploymentOrder: entities.map((entity) => entity.name),
    deploymentNotes,
    entities,
    relations,
  }
}

const createField = (
  name: string,
  type: IndexedAttributeType,
  value: string,
): EntityField => ({
  id: `${SCHEMA_FIELD_ID_PREFIX}${crypto.randomUUID()}`,
  name,
  type,
  value,
})

const createDataField = (key: string, value: string): EntityDataField => ({
  id: `${SCHEMA_DATA_FIELD_ID_PREFIX}${crypto.randomUUID()}`,
  key,
  value,
})

const createUniqueEdgeId = (
  sourceNodeId: string,
  targetNodeId: string,
  edgeName: string,
  seenEdgeIds: Set<string>,
) => {
  const baseEdgeId = `${SCHEMA_EDGE_ID_PREFIX}${sourceNodeId}-null-${targetNodeId}-null-${sanitizeIdentifier(edgeName) || 'relation'}`

  if (!seenEdgeIds.has(baseEdgeId)) {
    seenEdgeIds.add(baseEdgeId)
    return baseEdgeId
  }

  let suffix = 2
  let nextEdgeId = `${baseEdgeId}-${suffix}`

  while (seenEdgeIds.has(nextEdgeId)) {
    suffix += 1
    nextEdgeId = `${baseEdgeId}-${suffix}`
  }

  seenEdgeIds.add(nextEdgeId)
  return nextEdgeId
}

const dedupeEntityNames = (entities: GeneratedEntity[]): NamedGeneratedEntity[] => {
  const seen = new Set<string>()

  return entities.map((entity, index) => {
    const baseName = sanitizeIdentifier(entity.name) || `Entity_${index + 1}`
    let schemaName = baseName
    let suffix = 2

    while (seen.has(schemaName.toLowerCase())) {
      schemaName = `${baseName}_${suffix}`
      suffix += 1
    }

    seen.add(schemaName.toLowerCase())

    return {
      ...entity,
      schemaName,
    }
  })
}

const buildEntityLookup = (entities: NamedGeneratedEntity[]) => {
  const lookup = new Map<string, NamedGeneratedEntity>()

  entities.forEach((entity) => {
    lookup.set(entity.name.trim().toLowerCase(), entity)
    lookup.set(entity.schemaName.trim().toLowerCase(), entity)
  })

  return lookup
}

const buildGeneratedLayout = (
  entities: NamedGeneratedEntity[],
  relations: GeneratedRelation[],
) => {
  const lookup = buildEntityLookup(entities)
  const graph = new dagre.graphlib.Graph({ multigraph: false, compound: false })

  graph.setGraph({
    rankdir: 'LR',
    ranker: 'network-simplex',
    nodesep: DAGRE_NODE_SEP,
    ranksep: DAGRE_RANK_SEP,
    edgesep: DAGRE_EDGE_SEP,
    marginx: 0,
    marginy: 0,
  })
  graph.setDefaultEdgeLabel(() => ({}))

  entities.forEach((entity) => {
    graph.setNode(entity.schemaName, {
      width: SCHEMA_ENTITY_NODE_WIDTH,
      height: ENTITY_NODE_HEIGHT,
    })
  })

  relations.forEach((relation) => {
    const source = lookup.get(relation.sourceEntity.trim().toLowerCase())
    const target = lookup.get(relation.targetEntity.trim().toLowerCase())

    if (!source || !target || source.schemaName === target.schemaName) {
      return
    }

    graph.setEdge(source.schemaName, target.schemaName)
  })

  dagre.layout(graph)

  const initialPositions = new Map(
    entities.map((entity) => {
      const node = graph.node(entity.schemaName)
      const x = node
        ? node.x - SCHEMA_ENTITY_NODE_WIDTH / 2 + SCHEMA_ENTITY_START_X
        : SCHEMA_ENTITY_START_X
      const y = node
        ? node.y - ENTITY_NODE_HEIGHT / 2 + SCHEMA_ENTITY_START_Y
        : SCHEMA_ENTITY_START_Y
      return [entity.schemaName, { x, y }]
    }),
  )

  const incomingByNode = new Map<string, string[]>()
  const outgoingByNode = new Map<string, string[]>()

  entities.forEach((entity) => {
    incomingByNode.set(entity.schemaName, [])
    outgoingByNode.set(entity.schemaName, [])
  })

  relations.forEach((relation) => {
    const source = lookup.get(relation.sourceEntity.trim().toLowerCase())
    const target = lookup.get(relation.targetEntity.trim().toLowerCase())

    if (!source || !target || source.schemaName === target.schemaName) {
      return
    }

    incomingByNode.get(target.schemaName)?.push(source.schemaName)
    outgoingByNode.get(source.schemaName)?.push(target.schemaName)
  })

  const sortedByX = [...entities].sort(
    (left, right) =>
      (initialPositions.get(left.schemaName)?.x ?? 0) -
      (initialPositions.get(right.schemaName)?.x ?? 0),
  )

  const rankGroups: string[][] = []
  const X_EPSILON = 1

  sortedByX.forEach((entity) => {
    const x = initialPositions.get(entity.schemaName)?.x ?? 0
    const lastGroup = rankGroups[rankGroups.length - 1]

    if (!lastGroup) {
      rankGroups.push([entity.schemaName])
      return
    }

    const lastGroupX = initialPositions.get(lastGroup[0])?.x ?? 0
    if (Math.abs(x - lastGroupX) <= X_EPSILON) {
      lastGroup.push(entity.schemaName)
      return
    }

    rankGroups.push([entity.schemaName])
  })

  const positionY = new Map(
    entities.map((entity) => [entity.schemaName, initialPositions.get(entity.schemaName)?.y ?? 0]),
  )

  const sortByBarycenter = ({
    nodes,
    neighborsOf,
  }: {
    nodes: string[]
    neighborsOf: Map<string, string[]>
  }) =>
    [...nodes].sort((left, right) => {
      const leftNeighbors = neighborsOf.get(left) ?? []
      const rightNeighbors = neighborsOf.get(right) ?? []

      const leftCenter =
        leftNeighbors.length > 0
          ? leftNeighbors.reduce((sum, node) => sum + (positionY.get(node) ?? 0), 0) /
            leftNeighbors.length
          : positionY.get(left) ?? 0
      const rightCenter =
        rightNeighbors.length > 0
          ? rightNeighbors.reduce((sum, node) => sum + (positionY.get(node) ?? 0), 0) /
            rightNeighbors.length
          : positionY.get(right) ?? 0

      if (leftCenter !== rightCenter) {
        return leftCenter - rightCenter
      }

      return left.localeCompare(right)
    })

  for (let sweep = 0; sweep < 2; sweep += 1) {
    for (let rank = 1; rank < rankGroups.length; rank += 1) {
      rankGroups[rank] = sortByBarycenter({
        nodes: rankGroups[rank],
        neighborsOf: incomingByNode,
      })
    }

    for (let rank = rankGroups.length - 2; rank >= 0; rank -= 1) {
      rankGroups[rank] = sortByBarycenter({
        nodes: rankGroups[rank],
        neighborsOf: outgoingByNode,
      })
    }

    rankGroups.forEach((group, rank) => {
      const x =
        initialPositions.get(group[0])?.x ??
        SCHEMA_ENTITY_START_X + rank * DAGRE_RANK_SEP
      const centroidY =
        group.reduce((sum, node) => sum + (positionY.get(node) ?? 0), 0) /
        Math.max(group.length, 1)
      const startY = centroidY - ((group.length - 1) * LAYOUT_VERTICAL_GAP) / 2

      group.forEach((nodeName, index) => {
        const y = startY + index * LAYOUT_VERTICAL_GAP
        positionY.set(nodeName, y)
        initialPositions.set(nodeName, { x, y })
      })
    })
  }

  return initialPositions
}

export const buildSchemaGraphFromGeneratedModel = (
  model: GeneratedDataModel,
): { nodes: SchemaNode[]; edges: SchemaEdge[] } => {
  const namedEntities = dedupeEntityNames(model.entities)
  const lookup = buildEntityLookup(namedEntities)
  const layout = buildGeneratedLayout(namedEntities, model.relations)

  const nodes: SchemaNode[] = []
  const edges: SchemaEdge[] = []
  const nodeMap = new Map<string, SchemaNode>()
  const seenEdgeIds = new Set<string>()
  let selectedNodeId: string | undefined

  namedEntities
    .sort((left, right) => {
      const leftPosition = layout.get(left.schemaName)
      const rightPosition = layout.get(right.schemaName)

      if (!leftPosition || !rightPosition) {
        return left.schemaName.localeCompare(right.schemaName)
      }

      if (leftPosition.x !== rightPosition.x) {
        return leftPosition.x - rightPosition.x
      }

      return leftPosition.y - rightPosition.y
    })
    .forEach((entity) => {
      const nodeId = `${SCHEMA_NODE_ID_PREFIX}${crypto.randomUUID()}`
      const hasEntityType = entity.indexedAttributes.some(
        (attribute) => attribute.name.trim() === ENTITY_TYPE_ATTRIBUTE_KEY,
      )
      const indexedAttributesWithEntityType: GeneratedIndexedAttribute[] = hasEntityType
        ? entity.indexedAttributes
        : (() => {
            const projectIndex = entity.indexedAttributes.findIndex(
              (attribute) =>
                attribute.name.trim() === LEGACY_PROJECT_ATTRIBUTE_KEY ||
                attribute.name.trim().toLowerCase() === PROJECT_ATTRIBUTE_KEY,
            )
            const injected: GeneratedIndexedAttribute = {
              name: ENTITY_TYPE_ATTRIBUTE_KEY,
              type: 'indexedString',
              value: toEntityTypeValue(entity.schemaName),
            }
            const next = [...entity.indexedAttributes]
            const insertAt = projectIndex >= 0 ? projectIndex + 1 : 0
            next.splice(insertAt, 0, injected)
            return next
          })()

      const fields = indexedAttributesWithEntityType.map((attribute) =>
        createField(
          sanitizeIdentifier(attribute.name) || 'field',
          attribute.type,
          String(attribute.value ?? ''),
        ),
      )
      const projectAttributeValue = indexedAttributesWithEntityType.find(
        (attribute) =>
          attribute.name.trim() === LEGACY_PROJECT_ATTRIBUTE_KEY ||
          attribute.name.trim().toLowerCase() === PROJECT_ATTRIBUTE_KEY,
      )?.value
      const dataFields = entity.dataFields.map((field) =>
        createDataField(
          sanitizeIdentifier(field.key) || 'data',
          field.value,
        ),
      )
      const position = layout.get(entity.schemaName) ?? {
        x: SCHEMA_ENTITY_START_X,
        y: SCHEMA_ENTITY_START_Y,
      }

      const node: SchemaNode = {
        id: nodeId,
        type: 'entity',
        position,
        data: {
          mode: 'draft',
          label: entity.schemaName,
          projectAttributeValue:
            projectAttributeValue === undefined ? undefined : String(projectAttributeValue),
          expirationDuration: entity.expirationDuration,
          fields,
          dataFields,
        },
        selected: selectedNodeId === undefined,
      }

      if (!selectedNodeId) {
        selectedNodeId = nodeId
      }

      nodes.push(node)
      nodeMap.set(entity.schemaName, node)
    })

  let relationColorIndex = 0
  const parallelRelationOffsets = new Map<string, number>()

  model.relations.forEach((relation) => {
    const sourceEntity = lookup.get(relation.sourceEntity.trim().toLowerCase())
    const targetEntity = lookup.get(relation.targetEntity.trim().toLowerCase())

    if (!sourceEntity || !targetEntity) {
      return
    }

    const sourceNode = nodeMap.get(sourceEntity.schemaName)
    const targetNode = nodeMap.get(targetEntity.schemaName)

    if (!sourceNode || !targetNode) {
      return
    }

    const isSelfRelation = sourceNode.id === targetNode.id

    const relationFieldName =
      sanitizeIdentifier(relation.fieldName) ||
      `${sourceEntity.schemaName.charAt(0).toLowerCase()}${sourceEntity.schemaName.slice(1)}Id`
    const edgeId = createUniqueEdgeId(
      sourceNode.id,
      targetNode.id,
      relationFieldName,
      seenEdgeIds,
    )

    const existingField = targetNode.data.fields.find(
      (field) => field.name.toLowerCase() === relationFieldName.toLowerCase(),
    )

    if (existingField) {
      existingField.type = 'indexedString'
      existingField.value = ''
      existingField.edgeId = edgeId
      existingField.relationNodeId = sourceNode.id
    } else {
      targetNode.data.fields.push({
        ...createField(relationFieldName, 'indexedString', ''),
        edgeId,
        relationNodeId: sourceNode.id,
      })
    }

    if (!edgeId) {
      return
    }

    const relationColor = pickRelationColor(relationColorIndex)
    const parallelKey = `${sourceNode.id}::${targetNode.id}`
    const parallelOffsetIndex = parallelRelationOffsets.get(parallelKey) ?? 0
    parallelRelationOffsets.set(parallelKey, parallelOffsetIndex + 1)
    const pathOffset = 24 + parallelOffsetIndex * 12
    relationColorIndex += 1

    edges.push({
      id: edgeId,
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle: undefined,
      targetHandle: undefined,
      animated: true,
      style: { stroke: relationColor, strokeWidth: 2.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: relationColor,
      },
      pathOptions: {
        offset: pathOffset,
        borderRadius: 12,
      },
    } as SchemaEdge)
  })

  if (selectedNodeId) {
    nodes.forEach((node) => {
      node.selected = node.id === selectedNodeId
    })
  }

  return { nodes, edges }
}
