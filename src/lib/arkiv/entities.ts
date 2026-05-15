"use client";

import type { Hex } from "@arkiv-network/sdk";
import { desc, eq } from "@arkiv-network/sdk/query";
import { ExpirationTime, jsonToPayload, stringToPayload } from "@arkiv-network/sdk/utils";

import { createArkivPublicClient, createArkivWalletClient } from "@/lib/arkiv/client";
import { sanitizeIdentifier } from "@/lib/arkiv/schema";
import {
  getExpirationSeconds,
  mapEntityToSnapshot,
  mapEntityToSummary,
} from "@/lib/arkiv/mappers";
import type {
  BlockTimingState,
  DesignerPayload,
  EntityDataField,
  EntityField,
  ExpirationDuration,
  OwnedArkivEntitySummary,
  PersistedEntitySnapshot,
} from "@/lib/arkiv/types";
import { DESIGNER_APP_ID, DESIGNER_PAYLOAD_VERSION } from "@/lib/arkiv/types";

const PROJECT_ATTRIBUTE_KEY = 'project'
const LEGACY_PROJECT_ATTRIBUTE_KEY = 'PROJECT_ATTRIBUTE'
const ENTITY_TYPE_ATTRIBUTE_KEY = 'entityType'

const PROJECT_QUERY_LIMIT = 100

export const fetchBlockTiming = async (): Promise<BlockTimingState> => {
  const publicClient = createArkivPublicClient();
  return publicClient.getBlockTiming();
};

export const fetchWalletOwnedEntities = async (
  account: Hex,
): Promise<OwnedArkivEntitySummary[]> => {
  const publicClient = createArkivPublicClient();

  const result = await publicClient
    .buildQuery()
    .ownedBy(account)
    .withAttributes(true)
    .withMetadata(true)
    .withPayload(true)
    .orderBy(desc("createdAtBlock", "number"))
    .limit(50)
    .fetch();

  return result.entities.map(mapEntityToSummary);
};

export const fetchEntitiesByProjectAttribute = async (
  projectAttributeValue: string,
): Promise<OwnedArkivEntitySummary[]> => {
  const trimmedValue = projectAttributeValue.trim();

  if (!trimmedValue) {
    return [];
  }

  const publicClient = createArkivPublicClient();
  const queryByAttribute = async (attributeKey: string) => {
    const result = await publicClient
      .buildQuery()
      .where(eq(attributeKey, trimmedValue))
      .withAttributes(true)
      .withMetadata(true)
      .withPayload(true)
      .orderBy(desc("createdAtBlock", "number"))
      .limit(PROJECT_QUERY_LIMIT)
      .fetch();

    return result.entities.map(mapEntityToSummary);
  };

  const [currentMatches, legacyMatches] = await Promise.all([
    queryByAttribute(PROJECT_ATTRIBUTE_KEY),
    queryByAttribute(LEGACY_PROJECT_ATTRIBUTE_KEY),
  ]);
  const byKey = new Map<Hex, OwnedArkivEntitySummary>();

  for (const entity of [...currentMatches, ...legacyMatches]) {
    byKey.set(entity.key, entity);
  }

  return Array.from(byKey.values());
};

export const fetchEntityDetails = async (
  entityKey: Hex,
  blockTiming?: BlockTimingState,
): Promise<PersistedEntitySnapshot & { expirationDuration: ExpirationDuration }> => {
  const publicClient = createArkivPublicClient();
  const entity = await publicClient.getEntity(entityKey);
  const resolvedBlockTiming = blockTiming ?? (await fetchBlockTiming());

  return mapEntityToSnapshot(entity, resolvedBlockTiming);
};

const toAttributeValue = (field: EntityField) => {
  if (field.type === "indexedNumber") {
    const parsed = Number(field.value);

    if (!Number.isFinite(parsed)) {
      throw new Error(`"${field.name}" must contain a valid number.`);
    }

    return parsed;
  }

  return field.value;
};

const buildDesignerPayload = (label: string, fields: EntityField[]): DesignerPayload => ({
  app: DESIGNER_APP_ID,
  version: DESIGNER_PAYLOAD_VERSION,
  entityName: label,
  fields: fields.map((field) => ({
    name: field.name,
    type: field.type,
    value: toAttributeValue(field),
  })),
  deployedAt: new Date().toISOString(),
});

const buildProjectAttributeValue = ({
  label,
  projectAttributeValue,
}: {
  label: string;
  projectAttributeValue?: string;
}) => {
  const trimmedProjectAttributeValue = projectAttributeValue?.trim();

  if (trimmedProjectAttributeValue) {
    return trimmedProjectAttributeValue;
  }

  return label.trim();
};

const buildEntityTypeAttributeValue = (label: string) => {
  const sanitizedLabel = sanitizeIdentifier(label.trim()) || label.trim();

  if (!sanitizedLabel) {
    return 'entity';
  }

  return sanitizedLabel.charAt(0).toLowerCase() + sanitizedLabel.slice(1);
};

const buildIndexedAttributes = ({
  fields,
  label,
  projectAttributeValue,
}: {
  fields: EntityField[];
  label: string;
  projectAttributeValue?: string;
}) => {
  const attributes = fields.map((field) => ({
    key: field.name.trim(),
    value: toAttributeValue(field),
  }));

  const projectAttribute = attributes.find(
    (attribute) =>
      attribute.key === LEGACY_PROJECT_ATTRIBUTE_KEY ||
      attribute.key.toLowerCase() === PROJECT_ATTRIBUTE_KEY,
  );

  if (!projectAttribute) {
    attributes.unshift({
      key: PROJECT_ATTRIBUTE_KEY,
      value: buildProjectAttributeValue({ label, projectAttributeValue }),
    });
  }

  const entityTypeAttribute = attributes.find(
    (attribute) => attribute.key === ENTITY_TYPE_ATTRIBUTE_KEY,
  );

  if (!entityTypeAttribute) {
    const projectAttributeIndex = attributes.findIndex(
      (attribute) =>
        attribute.key === LEGACY_PROJECT_ATTRIBUTE_KEY ||
        attribute.key.toLowerCase() === PROJECT_ATTRIBUTE_KEY,
    );
    attributes.splice(projectAttributeIndex >= 0 ? projectAttributeIndex + 1 : 0, 0, {
      key: ENTITY_TYPE_ATTRIBUTE_KEY,
      value: buildEntityTypeAttributeValue(label),
    });
  }

  return attributes;
};

export const updatePersistedEntity = async ({
  account,
  entityKey,
  label,
  fields,
  entityData,
  projectAttributeValue,
  currentBlock,
  expirationBlock,
}: {
  account: Hex;
  entityKey: Hex;
  label: string;
  fields: EntityField[];
  entityData?: string;
  projectAttributeValue?: string;
  currentBlock: bigint;
  expirationBlock: bigint;
}) => {
  const validFields = fields.filter(
    (field) => field.name.trim().length > 0 && field.value.trim().length > 0,
  );

  const walletClient = createArkivWalletClient(account);
  const publicClient = createArkivPublicClient();

  // Build the new payload — merge the designer structure with any user-edited raw data
  let payloadBytes: Uint8Array;
  let contentType: string = 'application/json';

  if (entityData) {
    try {
      const parsed = JSON.parse(entityData);
      payloadBytes = jsonToPayload(parsed);
      contentType = 'application/json';
    } catch {
      payloadBytes = stringToPayload(entityData);
      contentType = 'text/plain';
    }
  } else {
    const payload = buildDesignerPayload(label, validFields);
    payloadBytes = jsonToPayload(payload);
  }

  const attributes = buildIndexedAttributes({
    fields: validFields,
    label,
    projectAttributeValue,
  });

  // RLP requires a canonical (non-zero, no leading-zero) uint64 for BTL.
  // We preserve the entity's existing expiry by passing the remaining blocks.
  // Clamp to 1 so we never encode 0.
  const remainingBlocks = expirationBlock > currentBlock
    ? Number(expirationBlock - currentBlock)
    : 1;

  const { txHash } = await walletClient.updateEntity({
    entityKey,
    payload: payloadBytes,
    contentType,
    attributes,
    expiresIn: remainingBlocks,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status === 'reverted') {
    throw new Error("Transaction failed on-chain.");
  }

  const blockTiming = await fetchBlockTiming();
  const entity = await publicClient.getEntity(entityKey);

  return {
    snapshot: mapEntityToSnapshot(entity, blockTiming),
    txHash,
  };
};

export const deployEntityFromDraft = async ({
  account,
  label,
  fields,
  expirationDuration,
  dataFields,
  projectAttributeValue,
}: {
  account: Hex;
  label: string;
  fields: EntityField[];
  expirationDuration: ExpirationDuration;
  dataFields?: EntityDataField[];
  projectAttributeValue?: string;
}) => {
  const trimmedLabel = label.trim();

  if (!trimmedLabel) {
    throw new Error("Project name is required before deploying.");
  }

  const validFields = fields.filter(
    (field) => field.name.trim().length > 0 && field.value.trim().length > 0,
  );

  if (validFields.length === 0) {
    throw new Error("Add at least one indexed field with a value before deploying.");
  }

  const walletClient = createArkivWalletClient(account);
  const publicClient = createArkivPublicClient();

  // If the user defined data fields, serialize them to a JSON object.
  // Fall back to an empty JSON object if none are provided.
  let payloadBytes: Uint8Array;
  const contentType = 'application/json';

  const validDataFields = (dataFields ?? []).filter((df) => df.key.trim().length > 0);

  if (validDataFields.length > 0) {
    const dataObj = Object.fromEntries(
      validDataFields.map((df) => [df.key.trim(), df.value]),
    )
    payloadBytes = jsonToPayload(dataObj)
  } else {
    payloadBytes = jsonToPayload({})
  }

  const expiresInSeconds = getExpirationSeconds(expirationDuration)
  const attributes = buildIndexedAttributes({
    fields: validFields,
    label: trimmedLabel,
    projectAttributeValue,
  })

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: payloadBytes,
    contentType,
    attributes,
    expiresIn: ExpirationTime.fromSeconds(expiresInSeconds),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status === 'reverted') {
    throw new Error("Deployment transaction failed on-chain.");
  }

  const blockTiming = await fetchBlockTiming();
  const entity = await publicClient.getEntity(entityKey);

  return {
    snapshot: mapEntityToSnapshot(entity, blockTiming),
    txHash,
  };
};

const buildCreateInputFromDraft = ({
  label,
  fields,
  expirationDuration,
  dataFields,
  projectAttributeValue,
}: {
  label: string;
  fields: EntityField[];
  expirationDuration: ExpirationDuration;
  dataFields?: EntityDataField[];
  projectAttributeValue?: string;
}) => {
  const trimmedLabel = label.trim();

  if (!trimmedLabel) {
    throw new Error("Project name is required before deploying.");
  }

  const validFields = fields.filter(
    (field) =>
      field.name.trim().length > 0 &&
      (field.value.trim().length > 0 || Boolean(field.edgeId)),
  );

  if (validFields.length === 0) {
    throw new Error(`Add at least one indexed field with a value before deploying ${trimmedLabel}.`);
  }

  const validDataFields = (dataFields ?? []).filter((df) => df.key.trim().length > 0);
  const dataObj = Object.fromEntries(
    validDataFields.map((df) => [df.key.trim(), df.value]),
  );

  return {
    payload: jsonToPayload(dataObj),
    contentType: 'application/json',
    attributes: buildIndexedAttributes({
      fields: validFields,
      label: trimmedLabel,
      projectAttributeValue,
    }),
    expiresIn: ExpirationTime.fromSeconds(getExpirationSeconds(expirationDuration)),
  };
};

type DraftBatchEntity = {
  nodeId: string;
  label: string;
  fields: EntityField[];
  expirationDuration: ExpirationDuration;
  dataFields?: EntityDataField[];
  projectAttributeValue?: string;
};

const buildDataPayload = (dataFields?: EntityDataField[]) => {
  const validDataFields = (dataFields ?? []).filter((df) => df.key.trim().length > 0);
  const dataObj = Object.fromEntries(
    validDataFields.map((df) => [df.key.trim(), df.value]),
  );

  return jsonToPayload(dataObj);
};

const resolveBatchRelationFields = (
  fields: EntityField[],
  createdKeyByNodeId: Map<string, Hex>,
) => {
  let changed = false;

  const resolvedFields = fields.map((field) => {
    if (!field.relationNodeId) {
      return field;
    }

    const relationEntityKey = createdKeyByNodeId.get(field.relationNodeId);
    if (!relationEntityKey || field.value === relationEntityKey) {
      return field;
    }

    changed = true;
    return {
      ...field,
      value: relationEntityKey,
    };
  });

  return { fields: resolvedFields, changed };
};

const buildUpdateInputFromCreatedDraft = ({
  entity,
  entityKey,
  fields,
}: {
  entity: DraftBatchEntity;
  entityKey: Hex;
  fields: EntityField[];
}) => {
  const validFields = fields.filter(
    (field) => field.name.trim().length > 0 && field.value.trim().length > 0,
  );

  return {
    entityKey,
    payload: buildDataPayload(entity.dataFields),
    contentType: 'application/json',
    attributes: buildIndexedAttributes({
      fields: validFields,
      label: entity.label.trim(),
      projectAttributeValue: entity.projectAttributeValue,
    }),
    expiresIn: getExpirationSeconds(entity.expirationDuration),
  };
};

export const deployDraftEntitiesBatch = async ({
  account,
  entities,
}: {
  account: Hex;
  entities: DraftBatchEntity[];
}) => {
  if (entities.length === 0) {
    throw new Error("Add at least one draft entity before deploying.");
  }

  const walletClient = createArkivWalletClient(account);
  const publicClient = createArkivPublicClient();
  const creates = entities.map(buildCreateInputFromDraft);

  const { txHash, createdEntities } = await walletClient.mutateEntities({
    creates,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status === 'reverted') {
    throw new Error("Batch deployment transaction failed on-chain.");
  }

  const blockTiming = await fetchBlockTiming();
  const createdKeyByNodeId = new Map<string, Hex>(
    entities.map((entity, index) => [entity.nodeId, createdEntities[index]]),
  );
  const resolvedFieldsByNodeId = new Map<string, EntityField[]>();
  const updates = entities.flatMap((entity, index) => {
    const entityKey = createdEntities[index];
    const { fields, changed } = resolveBatchRelationFields(
      entity.fields,
      createdKeyByNodeId,
    );

    resolvedFieldsByNodeId.set(entity.nodeId, fields);

    if (!entityKey || !changed) {
      return [];
    }

    return [buildUpdateInputFromCreatedDraft({ entity, entityKey, fields })];
  });

  let relationUpdateTxHash: string | undefined;

  if (updates.length > 0) {
    const updateResult = await walletClient.mutateEntities({ updates });
    relationUpdateTxHash = updateResult.txHash;
  }

  const snapshots = await Promise.all(
    createdEntities.map((entityKey) => fetchEntityDetails(entityKey, blockTiming)),
  );

  return {
    snapshots,
    txHash,
    relationUpdateTxHash,
    createdEntities,
    resolvedFieldsByNodeId,
  };
};
