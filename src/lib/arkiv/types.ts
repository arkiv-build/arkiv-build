import type { Hex } from "viem";

export const EXPIRATION_DURATION_OPTIONS = ["7d", "30d", "90d", "365d"] as const;

export const DESIGNER_APP_ID = "arkiv-visual-modeler";
export const DESIGNER_PAYLOAD_VERSION = 1;

export type ExpirationDuration = (typeof EXPIRATION_DURATION_OPTIONS)[number];
export type IndexedAttributeType = "indexedString" | "indexedNumber";
export type EntityNodeMode = "draft" | "persisted";

export type EntityField = {
  id: string;
  name: string;
  type: IndexedAttributeType;
  value: string;
};

export type SystemAttribute = {
  name: "$key" | "$creator" | "$owner" | "$expiration" | "$createdAtBlock";
  value: string;
};

export type OwnedArkivEntitySummary = {
  key: Hex;
  label: string;
  preview: string;
  explorerUrl: string;
  compatible: boolean;
  contentType?: string;
  createdAtBlock?: string;
  unsupportedReason?: string;
};

export type PersistedEntitySnapshot = {
  entityKey: Hex;
  label: string;
  fields: EntityField[];
  explorerUrl: string;
  systemAttributes: SystemAttribute[];
  confirmedExpirationBlock?: string;
};

export type BlockTimingState = {
  currentBlock: bigint;
  currentBlockTime: number;
  blockDuration: number;
};

export type DesignerPayload = {
  app: typeof DESIGNER_APP_ID;
  version: typeof DESIGNER_PAYLOAD_VERSION;
  entityName: string;
  fields: Array<{
    name: string;
    type: IndexedAttributeType;
    value: string | number;
  }>;
  deployedAt: string;
};
