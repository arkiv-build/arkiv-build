"use client";

import { Database, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSchemaStore } from "@/store/useSchemaStore";
import { useArkivStore } from "@/store/useArkivStore";

export function ArkivToolbar() {
  const addDraftEntity = useSchemaStore((state) => state.addDraftEntity);
  const error = useArkivStore((state) => state.error);

  return (
    <div className="w-[24rem] space-y-4">
      <div className="rounded-[16px] border border-gray-200 bg-white p-5 shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gray-100 text-[#ff7a45]">
            <Database className="size-6" />
          </div>

          <div className="min-w-0 flex-1 pr-10">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">
              Visual Modeler
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Create, view, edit and deploy Arkiv schemas.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            onClick={addDraftEntity}
            className="h-10 rounded-xl bg-[#ff7a45] px-4 hover:bg-[#ff692a] font-semibold text-white transition-colors"
          >
            <Plus className="size-4 mr-2" />
            New Draft
          </Button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
