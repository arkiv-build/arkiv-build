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
import { TopNav } from "@/components/TopNav";
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
    <div className="relative h-screen w-screen overflow-hidden bg-[#fafafa]">
      <TopNav />

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute top-[140px] bottom-6 left-6 flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="shrink-0">
              <ArkivToolbar />
            </div>
            <ArkivOwnedEntitiesPanel />
          </div>
        </div>

        <div className="pointer-events-auto absolute top-[140px] right-6">
          <Button
            variant="outline"
            onClick={clearCanvas}
            className="flex h-10 items-center gap-2 rounded-xl border-gray-200 bg-white px-4 font-bold shadow-sm transition hover:bg-gray-50 text-gray-700"
          >
            <Trash2 className="size-4" />
            Clear Canvas
          </Button>
        </div>
      </div>

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
        className="schema-flow pt-24"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1.15}
          color="rgba(148, 163, 184, 0.28)"
        />
        <Controls
          showInteractive={false}
          position="bottom-right"
          className="!overflow-hidden !rounded-[12px] !border !border-gray-200 !bg-white !shadow-sm"
        />
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
