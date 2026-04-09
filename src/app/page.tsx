"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { Plus, TableProperties } from "lucide-react";

import { EntityNode } from "@/components/EntityNode";
import { Button } from "@/components/ui/button";
import { useSchemaStore } from "@/store/useSchemaStore";

const nodeTypes = {
  entity: EntityNode,
};

function SchemaCanvas() {
  const nodes = useSchemaStore((state) => state.nodes);
  const edges = useSchemaStore((state) => state.edges);
  const onNodesChange = useSchemaStore((state) => state.onNodesChange);
  const onEdgesChange = useSchemaStore((state) => state.onEdgesChange);
  const onConnect = useSchemaStore((state) => state.onConnect);
  const addEntity = useSchemaStore((state) => state.addEntity);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.34),_transparent_28%),radial-gradient(circle_at_85%_16%,_rgba(255,255,255,0.96),_rgba(255,255,255,0)_26%),linear-gradient(180deg,_#f8fbff_0%,_#edf4ff_52%,_#f8fbff_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_24%),radial-gradient(circle_at_85%_12%,_rgba(56,189,248,0.08),_transparent_20%),linear-gradient(180deg,_#020617_0%,_#0f172a_58%,_#111827_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.5),rgba(15,23,42,0))]" />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        className="schema-flow"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1.15}
          color="rgba(148, 163, 184, 0.28)"
        />
        <Controls
          position="bottom-right"
          className="!overflow-hidden !rounded-[22px] !border !border-white/70 !bg-white/75 !shadow-[0_20px_45px_-28px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:!border-slate-800/80 dark:!bg-slate-950/80"
        />

        <Panel position="top-left">
          <div className="flex items-center gap-4 rounded-[26px] border border-white/70 bg-white/70 p-3.5 shadow-[0_25px_60px_-32px_rgba(15,23,42,0.38)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/72">
            <div className="flex size-11 items-center justify-center rounded-[18px] bg-slate-950 text-white shadow-[0_16px_32px_-18px_rgba(15,23,42,0.75)] dark:bg-slate-100 dark:text-slate-950">
              <TableProperties className="size-5" />
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Archive Visual Modeller
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Shape entities, edit fields inline, and map structure visually.
              </p>
            </div>

            <Button
              onClick={addEntity}
              className="h-11 rounded-[18px] px-4 shadow-[0_18px_36px_-22px_rgba(15,23,42,0.75)]"
              size="lg"
            >
              <Plus className="size-4" />
              Add Entity
            </Button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default function Home() {
  return (
    <ReactFlowProvider>
      <SchemaCanvas />
    </ReactFlowProvider>
  );
}
