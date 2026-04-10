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
          position="bottom-right"
          className="!overflow-hidden !rounded-[12px] !border !border-gray-200 !bg-white !shadow-sm"
        />

        <Panel position="top-left" style={{ top: "100px", left: "24px" }} className="m-0">
          <div className="space-y-4">
            <ArkivToolbar />
            <ArkivOwnedEntitiesPanel />
          </div>
        </Panel>

        <Panel position="top-right" style={{ top: "100px", right: "24px" }} className="m-0">
          <Button
            variant="outline"
            onClick={clearCanvas}
            className="flex h-10 items-center gap-2 rounded-xl border-gray-200 bg-white px-4 font-bold shadow-sm transition hover:bg-gray-50 text-gray-700"
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
