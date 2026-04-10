"use client";

import { LoaderCircle, Plus, Rocket, TableProperties, Wallet } from "lucide-react";

import { ARKIV_CHAIN } from "@/lib/arkiv/chain";
import { Button } from "@/components/ui/button";
import { useArkivStore } from "@/store/useArkivStore";
import { useSchemaStore } from "@/store/useSchemaStore";

const shortAddress = (address?: string) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected";

export function ArkivToolbar() {
  const addDraftEntity = useSchemaStore((state) => state.addDraftEntity);
  const activeNodeId = useSchemaStore((state) => state.activeNodeId);
  const nodes = useSchemaStore((state) => state.nodes);
  const connectWallet = useArkivStore((state) => state.connectWallet);
  const retryNetworkSwitch = useArkivStore((state) => state.retryNetworkSwitch);
  const deployActiveDraft = useArkivStore((state) => state.deployActiveDraft);
  const connecting = useArkivStore((state) => state.connecting);
  const deploying = useArkivStore((state) => state.deploying);
  const account = useArkivStore((state) => state.account);
  const chainId = useArkivStore((state) => state.chainId);
  const networkNudge = useArkivStore((state) => state.networkNudge);
  const error = useArkivStore((state) => state.error);
  const walletAvailable = useArkivStore((state) => state.walletAvailable);

  const activeNode = nodes.find((node) => node.id === activeNodeId) ?? nodes[0];
  const activeNodeIsDraft = activeNode?.data.mode === "draft";
  const onArkivNetwork = chainId === ARKIV_CHAIN.id;

  return (
    <div className="w-[24rem] space-y-3">
      <div className="rounded-[28px] border border-white/70 bg-white/72 p-4 shadow-[0_25px_60px_-32px_rgba(15,23,42,0.38)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/72">
        <div className="flex items-center gap-4">
          <div className="flex size-11 items-center justify-center rounded-[18px] bg-slate-950 text-white shadow-[0_16px_32px_-18px_rgba(15,23,42,0.75)] dark:bg-slate-100 dark:text-slate-950">
            <TableProperties className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Archive Visual Modeller
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Connect MetaMask, fetch Arkiv entities, and deploy new drafts to Kaolin.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={account ? retryNetworkSwitch : connectWallet}
            className="h-11 rounded-[18px] px-4 shadow-[0_18px_36px_-22px_rgba(15,23,42,0.75)]"
            size="lg"
            disabled={connecting}
          >
            {connecting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Wallet className="size-4" />
            )}
            {account ? shortAddress(account) : "Connect MetaMask"}
          </Button>

          <Button
            onClick={addDraftEntity}
            variant="outline"
            className="h-11 rounded-[18px] px-4"
            size="lg"
          >
            <Plus className="size-4" />
            New Draft
          </Button>

          <Button
            onClick={deployActiveDraft}
            className="h-11 rounded-[18px] px-4"
            size="lg"
            disabled={!walletAvailable || !account || !onArkivNetwork || !activeNodeIsDraft || deploying}
          >
            {deploying ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Rocket className="size-4" />
            )}
            Deploy to Kaolin
          </Button>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/70 bg-white/70 p-3.5 shadow-[0_20px_48px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Network Status
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {walletAvailable
                ? onArkivNetwork
                  ? `${ARKIV_CHAIN.name} ready`
                  : networkNudge ?? "Switch MetaMask to Arkiv Kaolin."
                : "MetaMask not detected"}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={[
                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
                onArkivNetwork
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
              ].join(" ")}
            >
              {onArkivNetwork ? "Kaolin" : "Wrong network"}
            </span>

            {walletAvailable && !onArkivNetwork && (
              <Button
                variant="outline"
                size="sm"
                onClick={retryNetworkSwitch}
                className="h-8 rounded-full px-3 text-xs shadow-sm"
              >
                Switch Network
              </Button>
            )}
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-[18px] border border-rose-100 bg-rose-50/80 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/15 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
