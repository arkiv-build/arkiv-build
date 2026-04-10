"use client";

import type { Hex } from "@arkiv-network/sdk";
import { desc } from "@arkiv-network/sdk/query";
import { ExpirationTime, jsonToPayload, stringToPayload } from "@arkiv-network/sdk/utils";

import { createArkivPublicClient, createArkivWalletClient } from "@/lib/arkiv/client";
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

export const updatePersistedEntity = async ({
  account,
  entityKey,
  label,
  fields,
  entityData,
  currentBlock,
  expirationBlock,
}: {
  account: Hex;
  entityKey: Hex;
  label: string;
  fields: EntityField[];
  entityData?: string;
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

  const attributes = validFields.map((field) => ({
    key: field.name.trim(),
    value: toAttributeValue(field),
  }));

  attributes.push({
    key: "type",
    value: label.trim(),
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
}: {
  account: Hex;
  label: string;
  fields: EntityField[];
  expirationDuration: ExpirationDuration;
  dataFields?: EntityDataField[];
}) => {
  const trimmedLabel = label.trim();

  if (!trimmedLabel) {
    throw new Error("Entity name is required before deploying.");
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
  // Fall back to the auto-generated designer payload if none are provided.
  let payloadBytes: Uint8Array;
  const contentType = 'application/json';

  const validDataFields = (dataFields ?? []).filter((df) => df.key.trim().length > 0);

  if (validDataFields.length > 0) {
    const dataObj = Object.fromEntries(
      validDataFields.map((df) => [df.key.trim(), df.value]),
    )
    payloadBytes = jsonToPayload(dataObj)
  } else {
    const payload = buildDesignerPayload(trimmedLabel, validFields)
    payloadBytes = jsonToPayload(payload)
  }

  const expiresInSeconds = getExpirationSeconds(expirationDuration)
  const attributes = validFields.map((field) => ({
    key: field.name.trim(),
    value: toAttributeValue(field),
  }))

  attributes.push({
    key: "type",
    value: trimmedLabel,
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
