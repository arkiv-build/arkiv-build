import dagre from 'dagre'
import { MarkerType } from '@xyflow/react'

import type { SchemaEdge, SchemaNode } from '@/store/useSchemaStore'
import type {
  EntityDataField,
  EntityField,
  ExpirationDuration,
  IndexedAttributeType,
} from '@/lib/arkiv/types'
import { sanitizeIdentifier } from '@/lib/arkiv/schema'

const EXPIRATION_DURATIONS: ExpirationDuration[] = ['1d', '7d', '30d', '90d', '365d']
const ENTITY_START_X = 96
const ENTITY_START_Y = 140
const ENTITY_NODE_WIDTH = 544
const ENTITY_NODE_HEIGHT = 110
const DAGRE_RANK_SEP = 160
const DAGRE_NODE_SEP = 70
const DAGRE_EDGE_SEP = 30

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
  typeof value === 'string' && EXPIRATION_DURATIONS.includes(value as ExpirationDuration)
    ? (value as ExpirationDuration)
    : '30d'

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

  const entities = nodes.map((node, index) => ({
    name: node.data.label.trim() || `Entity_${index + 1}`,
    expirationDuration: node.data.expirationDuration,
    indexedAttributes: node.data.fields.map((field) => ({
      name: field.name,
      type: field.type,
      value:
        field.type === 'indexedNumber' && Number.isFinite(Number(field.value))
          ? Number(field.value)
          : field.value,
    })),
    dataFields: extractEntityDataFields(node),
  }))

  return {
    title: 'Current canvas model',
    summary: 'The current Arkiv model already on the canvas.',
    deploymentOrder: entities.map((entity) => entity.name),
    deploymentNotes: [],
    entities,
    relations,
  }
}

const createField = (
  name: string,
  type: IndexedAttributeType,
  value: string,
): EntityField => ({
  id: `field-${crypto.randomUUID()}`,
  name,
  type,
  value,
})

const createDataField = (key: string, value: string): EntityDataField => ({
  id: `data-${crypto.randomUUID()}`,
  key,
  value,
})

const createUniqueEdgeId = (
  sourceNodeId: string,
  targetNodeId: string,
  edgeName: string,
  seenEdgeIds: Set<string>,
) => {
  const baseEdgeId = `xy-edge__${sourceNodeId}-null-${targetNodeId}-null-${sanitizeIdentifier(edgeName) || 'relation'}`

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
    ranker: 'tight-tree',
    nodesep: DAGRE_NODE_SEP,
    ranksep: DAGRE_RANK_SEP,
    edgesep: DAGRE_EDGE_SEP,
    marginx: 0,
    marginy: 0,
  })
  graph.setDefaultEdgeLabel(() => ({}))

  entities.forEach((entity) => {
    graph.setNode(entity.schemaName, {
      width: ENTITY_NODE_WIDTH,
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

  return new Map(
    entities.map((entity) => {
      const node = graph.node(entity.schemaName)
      const x = node ? node.x - ENTITY_NODE_WIDTH / 2 + ENTITY_START_X : ENTITY_START_X
      const y = node ? node.y - ENTITY_NODE_HEIGHT / 2 + ENTITY_START_Y : ENTITY_START_Y
      return [entity.schemaName, { x, y }]
    }),
  )
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
      const nodeId = `entity-${crypto.randomUUID()}`
      const fields = entity.indexedAttributes.map((attribute) =>
        createField(
          sanitizeIdentifier(attribute.name) || 'field',
          attribute.type,
          String(attribute.value ?? ''),
        ),
      )
      const dataFields = entity.dataFields.map((field) =>
        createDataField(
          sanitizeIdentifier(field.key) || 'data',
          field.value,
        ),
      )
      const position = layout.get(entity.schemaName) ?? {
        x: ENTITY_START_X,
        y: ENTITY_START_Y,
      }

      const node: SchemaNode = {
        id: nodeId,
        type: 'entity',
        position,
        data: {
          mode: 'draft',
          label: entity.schemaName,
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

    const relationColor = pickRelationColor(relationColorIndex)
    const pathOffset = 16 + (relationColorIndex % 6) * 14
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
