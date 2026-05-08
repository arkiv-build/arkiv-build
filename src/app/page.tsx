"use client";

import "@xyflow/react/dist/style.css";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trash2,
  ArrowUp,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
} from "lucide-react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";

import { ArkivOwnedEntitiesPanel } from "@/components/ArkivOwnedEntitiesPanel";
import { ArkivToolbar } from "@/components/ArkivToolbar";
import { TopNav } from "@/components/TopNav";
import { UseCasePromptPanel } from "@/components/UseCasePromptPanel";
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
  const startBalanceSync = useArkivStore((state) => state.startBalanceSync);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const { setCenter, getNodes } = useReactFlow();
  const previousNodeIdsRef = useRef<Set<string>>(new Set());
  const nodeIdsKey = useMemo(() => nodes.map((node) => node.id).join('|'), [nodes]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const allNodes = getNodes();
      if (allNodes.length === 0) {
        previousNodeIdsRef.current = new Set();
        return;
      }

      const previousNodeIds = previousNodeIdsRef.current;
      const addedNodes = allNodes.filter((node) => !previousNodeIds.has(node.id));
      const newestAddedNode =
        [...addedNodes].reverse().find((node) => node.selected) ??
        addedNodes[addedNodes.length - 1];

      if (newestAddedNode) {
        const width = newestAddedNode.measured?.width || 544;
        const centerX = newestAddedNode.position.x + width / 2 + 400;
        const centerY = newestAddedNode.position.y + 500;

        setCenter(centerX, centerY, { zoom: 0.45, duration: 600 });
        previousNodeIdsRef.current = new Set(allNodes.map((node) => node.id));
        return;
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity;
      allNodes.forEach((n) => {
        const x = n.position.x;
        const y = n.position.y;
        const w = n.measured?.width || 544;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
      });

      const centerX = minX + (maxX - minX) / 2 + 400;
      setCenter(centerX, minY + 500, { zoom: 0.45, duration: 600 });
      previousNodeIdsRef.current = new Set(allNodes.map((node) => node.id));
    }, 50);
    return () => clearTimeout(timeout);
  }, [nodeIdsKey, setCenter, getNodes]);

  useEffect(() => {
    void initializeArkiv();
    return startBalanceSync();
  }, [initializeArkiv, startBalanceSync]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#fafafa]">
      <TopNav />

      <div className="pointer-events-none absolute inset-0 z-10">
        {isAiPanelOpen ? (
          <button
            type="button"
            aria-label="Close AI assistant"
            className="pointer-events-auto absolute inset-0 z-10 cursor-default"
            onClick={() => setIsAiPanelOpen(false)}
          />
        ) : null}

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

        <div className="pointer-events-auto absolute top-[110px] right-6 z-20">
          <Button
            variant="outline"
            onClick={clearCanvas}
            className="ml-auto flex h-11 items-center gap-2 rounded-xl border border-[#ffb3ad] bg-[#fff0ee] px-4 font-bold shadow-sm transition hover:bg-[#ffe1de] text-[#ff3b30] hover:text-red-600"
          >
            <Trash2 className="size-4" />
            Clear Canvas
          </Button>
        </div>

        <div className="pointer-events-auto absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
          <div className="relative flex flex-col items-center">
            {isAiPanelOpen ? (
              <Button
                variant="ghost"
                className="absolute -top-10 right-3 z-20 h-8 w-8 rounded-xl border border-[#ffbe9f] bg-[#fff5f0] text-[#ff7a45] transition-all duration-300 hover:bg-[#ffe8db] hover:text-[#e66a39]"
                onClick={() => setIsAiPanelOpen(false)}
                title="Collapse AI assistant"
              >
                <PanelRightClose className="size-4" />
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAiPanelOpen(true)}
                className="group flex h-[7.25rem] w-[min(44rem,calc(100vw-2rem))] flex-col justify-between rounded-[1.6rem] border border-[#ffd8c3] bg-white/95 px-5 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.14)] backdrop-blur-md transition hover:border-[#ffc3a6] hover:bg-white"
                title="Open AI assistant"
              >
                <p className="font-mono text-sm font-normal tracking-wide text-gray-500 md:text-base">
                  Ask for follow-up changes
                </p>

                <div className="flex items-center justify-end">
                  <div className="flex size-11 items-center justify-center rounded-full bg-[#f2f4f7] text-gray-500 transition group-hover:bg-[#ffefe5] group-hover:text-[#ff7a45]">
                    <ArrowUp className="size-5" />
                  </div>
                </div>
              </button>
            )}

            <div
              className={`origin-bottom overflow-hidden transition-all duration-300 ${
                isAiPanelOpen
                  ? "h-[60vh] w-[min(56rem,calc(100vw-2rem))] max-h-[60vh] opacity-100 translate-y-0"
                  : "h-0 w-[min(56rem,calc(100vw-2rem))] opacity-0 translate-y-3"
              }`}
            >
              <div className="h-full w-[min(56rem,calc(100vw-2rem))]">
                <UseCasePromptPanel onSchemaBuilt={() => setIsAiPanelOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute inset-0 transition-all duration-300"
        style={{
          paddingLeft: isMenuOpen ? '416px' : '0px',
          paddingTop: '80px',
        }}
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
          minZoom={0.1}
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
            orientation="horizontal"
            position="bottom-center"
            className="!bottom-6 !left-1/2 !-translate-x-1/2 !overflow-hidden !rounded-[10px] !border !border-gray-200/50 !bg-white/40 !shadow-sm !backdrop-blur-md"
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
