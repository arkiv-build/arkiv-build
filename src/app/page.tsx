"use client";

import "@xyflow/react/dist/style.css";

import { useEffect, useMemo, useState } from "react";
import { Trash2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";

import { ArkivOwnedEntitiesPanel } from "@/components/ArkivOwnedEntitiesPanel";
import { ArkivToolbar } from "@/components/ArkivToolbar";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { EntityNode } from "@/components/EntityNode";
import { useArkivStore } from "@/store/useArkivStore";
import { useSchemaStore } from "@/store/useSchemaStore";

const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#ff7a45' },
  style: { strokeWidth: 2.5 },
}

function SchemaCanvas() {
  const nodeTypes = useMemo(() => ({ entity: EntityNode }), []);
  const nodes = useSchemaStore((state) => state.nodes);
  const edges = useSchemaStore((state) => state.edges);
  const onNodesChange = useSchemaStore((state) => state.onNodesChange);
  const onEdgesChange = useSchemaStore((state) => state.onEdgesChange);
  const onConnect = useSchemaStore((state) => state.onConnect);
  const setActiveNode = useSchemaStore((state) => state.setActiveNode);
  const clearCanvas = useSchemaStore((state) => state.clearCanvas);
  const initializeArkiv = useArkivStore((state) => state.initialize);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const { setCenter, getNodes } = useReactFlow();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const allNodes = getNodes();
      if (allNodes.length === 0) return;

      let minX = Infinity, minY = Infinity, maxX = -Infinity;
      allNodes.forEach((n) => {
        const x = n.position.x;
        const y = n.position.y;
        const w = n.measured?.width || 544;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
      });

      const centerX = minX + (maxX - minX) / 2;
      setCenter(centerX, minY, { zoom: 0.9, duration: 600 });
    }, 50);
    return () => clearTimeout(timeout);
  }, [nodes.length, setCenter, getNodes]);

  useEffect(() => {
    void initializeArkiv();
  }, [initializeArkiv]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#fafafa]">
      <TopNav />

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute top-[110px] bottom-6 left-6 flex min-h-0 flex-col transition-all duration-300">
          <Button
            variant={isMenuOpen ? "ghost" : "outline"}
            className={`pointer-events-auto absolute z-20 flex p-0 items-center justify-center rounded-lg transition-all duration-300 ${
              isMenuOpen 
                ? 'h-8 w-8 top-3 left-[334px] text-[#ff7a45] hover:text-[#e66a39] bg-[#fff5f0] hover:bg-[#ffebe0]' 
                : 'h-10 w-10 top-0 left-0 bg-white border border-gray-200 shadow-sm text-[#ff7a45] hover:text-[#e66a39] hover:bg-[#fff5f0]'
            }`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-5" />}
          </Button>

          <div 
            className={`pointer-events-auto flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden transition-all duration-300 ${isMenuOpen ? 'w-[24rem] opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full'}`}
          >
            <div className="shrink-0 w-[24rem]">
              <ArkivToolbar />
            </div>
            <div className="flex-1 min-h-0 w-[24rem] flex flex-col">
              <ArkivOwnedEntitiesPanel />
            </div>
          </div>
        </div>

        <div className="pointer-events-auto absolute top-[110px] right-6">
          <Button
            variant="outline"
            onClick={clearCanvas}
            className="flex h-10 items-center gap-2 rounded-xl border-red-200 bg-red-50 px-4 font-bold shadow-sm transition hover:bg-red-100 text-[#ff3b30] hover:text-red-600"
          >
            <Trash2 className="size-4" />
            Clear Canvas
          </Button>
        </div>
      </div>

      <div
        className="absolute inset-0 transition-all duration-300"
        style={{ paddingLeft: isMenuOpen ? '416px' : '0px', paddingTop: '80px' }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setActiveNode(node.id)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.4}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          className="schema-flow h-full w-full"
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
