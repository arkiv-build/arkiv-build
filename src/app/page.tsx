"use client";

import "@xyflow/react/dist/style.css";

import { useEffect } from "react";
import { Trash2 } from "lucide-react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";

import { ArkivOwnedEntitiesPanel } from "@/components/ArkivOwnedEntitiesPanel";
import { ArkivToolbar } from "@/components/ArkivToolbar";
import { Button } from "@/components/ui/button";
import { EntityNode } from "@/components/EntityNode";
import { useArkivStore } from "@/store/useArkivStore";
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
  const setActiveNode = useSchemaStore((state) => state.setActiveNode);
  const clearCanvas = useSchemaStore((state) => state.clearCanvas);
  const initializeArkiv = useArkivStore((state) => state.initialize);

  useEffect(() => {
    void initializeArkiv();
  }, [initializeArkiv]);

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
        onNodeClick={(_, node) => setActiveNode(node.id)}
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
          <div className="space-y-3">
            <ArkivToolbar />
            <ArkivOwnedEntitiesPanel />
          </div>
        </Panel>

        <Panel position="top-right" className="m-6">
          <Button
            variant="outline"
            onClick={clearCanvas}
            className="flex h-11 items-center gap-2 rounded-[18px] border-white/70 bg-white/75 px-4 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.4)] backdrop-blur-xl transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-800/80 dark:bg-slate-950/80 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <Trash2 className="size-4" />
            Clear Canvas
          </Button>
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
