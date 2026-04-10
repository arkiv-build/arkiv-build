import type { Entity } from "@arkiv-network/sdk";

import { getEntityExplorerUrl } from "@/lib/arkiv/chain";
import {
  DESIGNER_APP_ID,
  type BlockTimingState,
  type DesignerPayload,
  type EntityField,
  type ExpirationDuration,
  type IndexedAttributeType,
  type OwnedArkivEntitySummary,
  type PersistedEntitySnapshot,
  type SystemAttribute,
} from "@/lib/arkiv/types";

const durationDaysMap: Record<ExpirationDuration, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export const formatBlockNumber = (value?: bigint | number) => {
  if (value === undefined) {
    return undefined;
  }

  return Number(value).toLocaleString("en-US");
};

export const getExpirationSeconds = (duration: ExpirationDuration) =>
  durationDaysMap[duration] * 24 * 60 * 60;

export const estimateExpirationBlock = (
  duration: ExpirationDuration,
  blockTiming?: BlockTimingState,
) => {
  if (!blockTiming || blockTiming.blockDuration <= 0) {
    return undefined;
  }

  const blocksUntilExpiration = Math.ceil(
    getExpirationSeconds(duration) / blockTiming.blockDuration,
  );

  return BigInt(blockTiming.currentBlock) + BigInt(blocksUntilExpiration);
};

const parsePayload = (entity: Entity): DesignerPayload | Record<string, unknown> | null => {
  try {
    const payload = entity.toJson();

    if (payload && typeof payload === "object") {
      return payload as DesignerPayload | Record<string, unknown>;
    }

    return null;
  } catch {
    return null;
  }
};

const payloadLooksLikeDesignerPayload = (
  payload: DesignerPayload | Record<string, unknown> | null,
): payload is DesignerPayload =>
  Boolean(
    payload &&
      "app" in payload &&
      payload.app === DESIGNER_APP_ID &&
      "fields" in payload &&
      Array.isArray(payload.fields),
  );

const coerceFieldType = (value: string | number): IndexedAttributeType =>
  typeof value === "number" ? "indexedNumber" : "indexedString";

const coerceDurationFromBlocks = (
  expiresAtBlock: bigint | undefined,
  blockTiming?: BlockTimingState,
): ExpirationDuration => {
  if (!expiresAtBlock || !blockTiming || blockTiming.blockDuration <= 0) {
    return "30d";
  }

  const remainingBlocks = Number(BigInt(expiresAtBlock) - BigInt(blockTiming.currentBlock));

  if (remainingBlocks <= 0) {
    return "7d";
  }

  const remainingSeconds = remainingBlocks * blockTiming.blockDuration;

  const closest = (Object.entries(durationDaysMap) as Array<
    [ExpirationDuration, number]
  >).reduce(
    (best, [duration, days]) => {
      const diff = Math.abs(days * 24 * 60 * 60 - remainingSeconds);
      return diff < best.diff ? { duration, diff } : best;
    },
    { duration: "30d" as ExpirationDuration, diff: Number.POSITIVE_INFINITY },
  );

  return closest.duration;
};

const mapGenericAttributesToFields = (entity: Entity) =>
  entity.attributes.map(
    (attribute): EntityField => ({
      id: `${attribute.key}-${crypto.randomUUID()}`,
      name: attribute.key,
      type: coerceFieldType(attribute.value),
      value: String(attribute.value),
    }),
  );

const getEntityLabel = (
  entity: Entity,
  payload: DesignerPayload | Record<string, unknown> | null,
) => {
  if (payloadLooksLikeDesignerPayload(payload) && payload.entityName) {
    return payload.entityName;
  }

  if (
    payload &&
    "entityName" in payload &&
    typeof payload.entityName === "string" &&
    payload.entityName.length > 0
  ) {
    return payload.entityName;
  }

  if (
    payload &&
    "name" in payload &&
    typeof payload.name === "string" &&
    payload.name.length > 0
  ) {
    return payload.name;
  }

  const typeAttribute = entity.attributes.find((attribute) => attribute.key === "type");

  if (typeof typeAttribute?.value === "string" && typeAttribute.value.length > 0) {
    return typeAttribute.value;
  }

  return `Entity ${entity.key.slice(0, 10)}...`;
};

export const mapEntityToSummary = (entity: Entity): OwnedArkivEntitySummary => {
  const payload = parsePayload(entity);
  const compatible =
    payloadLooksLikeDesignerPayload(payload) || entity.attributes.length > 0 || Boolean(payload);

  return {
    key: entity.key,
    label: getEntityLabel(entity, payload),
    preview:
      entity.attributes.length > 0
        ? `${entity.attributes.length} indexed attribute${
            entity.attributes.length === 1 ? "" : "s"
          }`
        : entity.contentType ?? "No queryable attributes",
    explorerUrl: getEntityExplorerUrl(entity.key),
    compatible,
    contentType: entity.contentType,
    createdAtBlock: formatBlockNumber(entity.createdAtBlock),
    unsupportedReason: compatible
      ? undefined
      : "This entity has no JSON payload or indexed attributes the designer can render.",
  };
};

export const mapEntityToSnapshot = (
  entity: Entity,
  blockTiming?: BlockTimingState,
): PersistedEntitySnapshot & { expirationDuration: ExpirationDuration } => {
  const payload = parsePayload(entity);
  const fields = payloadLooksLikeDesignerPayload(payload)
    ? payload.fields.map(
        (field): EntityField => ({
          id: `${field.name}-${crypto.randomUUID()}`,
          name: field.name,
          type: field.type,
          value: String(field.value),
        }),
      )
    : mapGenericAttributesToFields(entity);

  const systemAttributes: SystemAttribute[] = [
    { name: "$key", value: entity.key },
    { name: "$creator", value: entity.creator ?? "Unavailable" },
    { name: "$owner", value: entity.owner ?? "Unavailable" },
    {
      name: "$expiration",
      value: formatBlockNumber(entity.expiresAtBlock) ?? "Unavailable",
    },
    {
      name: "$createdAtBlock",
      value: formatBlockNumber(entity.createdAtBlock) ?? "Unavailable",
    },
  ];

  return {
    entityKey: entity.key,
    label: getEntityLabel(entity, payload),
    fields,
    explorerUrl: getEntityExplorerUrl(entity.key),
    systemAttributes,
    confirmedExpirationBlock: formatBlockNumber(entity.expiresAtBlock),
    expirationDuration: coerceDurationFromBlocks(entity.expiresAtBlock, blockTiming),
    entityData: entity.toText(),
    entitySize: entity.payload?.length ?? 0,
  };
};
