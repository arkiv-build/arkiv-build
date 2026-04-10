"use client";

import type { Hex } from "@arkiv-network/sdk";
import { desc } from "@arkiv-network/sdk/query";
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk/utils";

import { createArkivPublicClient, createArkivWalletClient } from "@/lib/arkiv/client";
import {
  getExpirationSeconds,
  mapEntityToSnapshot,
  mapEntityToSummary,
} from "@/lib/arkiv/mappers";
import type {
  BlockTimingState,
  DesignerPayload,
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

export const deployEntityFromDraft = async ({
  account,
  label,
  fields,
  expirationDuration,
}: {
  account: Hex;
  label: string;
  fields: EntityField[];
  expirationDuration: ExpirationDuration;
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
  const payload = buildDesignerPayload(trimmedLabel, validFields);
  const expiresInSeconds = getExpirationSeconds(expirationDuration);
  const attributes = validFields.map((field) => ({
    key: field.name.trim(),
    value: toAttributeValue(field),
  }));

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes,
    expiresIn: ExpirationTime.fromSeconds(expiresInSeconds),
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const blockTiming = await fetchBlockTiming();
  const entity = await publicClient.getEntity(entityKey);

  return {
    snapshot: mapEntityToSnapshot(entity, blockTiming),
    txHash,
  };
};
