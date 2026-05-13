"use client";

import "@xyflow/react/dist/style.css";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trash2,
  Clipboard,
  ClipboardPaste,
  ArrowUp,
  PanelLeftClose,
  PanelLeftOpen,
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
import {
  buildSchemaGraphFromGeneratedModel,
  normalizeGeneratedDataModel,
  serializeCanvasToGeneratedDataModel,
} from "@/lib/ai/dataModel";
import { SCHEMA_ENTITY_NODE_WIDTH } from '@/lib/constants/schema'
import { getErrorMessage } from "@/lib/errors";
import { useArkivStore } from "@/store/useArkivStore";
import { useSchemaStore } from "@/store/useSchemaStore";

const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#ff7a45' },
  style: { strokeWidth: 2.5 },
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function SchemaCanvas() {
  const nodeTypes = useMemo(() => ({ entity: EntityNode }), []);
  const nodes = useSchemaStore((state) => state.nodes);
  const edges = useSchemaStore((state) => state.edges);
  const onNodesChange = useSchemaStore((state) => state.onNodesChange);
  const onEdgesChange = useSchemaStore((state) => state.onEdgesChange);
  const onConnect = useSchemaStore((state) => state.onConnect);
  const setActiveNode = useSchemaStore((state) => state.setActiveNode);
  const loadGraphOfEntities = useSchemaStore((state) => state.loadGraphOfEntities);
  const clearCanvas = useSchemaStore((state) => state.clearCanvas);
  const initializeArkiv = useArkivStore((state) => state.initialize);
  const startBalanceSync = useArkivStore((state) => state.startBalanceSync);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isPastingModel, setIsPastingModel] = useState(false);
  const { setCenter, getNodes } = useReactFlow();
  const previousNodeIdsRef = useRef<Set<string>>(new Set());
  const nodeIdsKey = useMemo(() => nodes.map((node) => node.id).join('|'), [nodes]);
  const isDevMode = process.env.NODE_ENV === 'development'

  const handleCopyCanvasModel = async () => {
    const model = serializeCanvasToGeneratedDataModel(nodes, edges)
    const payload = {
      exportedAt: new Date().toISOString(),
      model,
    }

    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
  }

  const handlePasteCanvasModel = async () => {
    setIsPastingModel(true)

    try {
      const clipboardText = await navigator.clipboard.readText()
      const parsed = JSON.parse(clipboardText) as unknown
      const candidateModel =
        isRecord(parsed) && 'model' in parsed ? parsed.model : parsed
      const model = normalizeGeneratedDataModel(candidateModel)
      const { nodes: nextNodes, edges: nextEdges } =
        buildSchemaGraphFromGeneratedModel(model)

      loadGraphOfEntities(nextNodes, nextEdges)
    } catch (error) {
      window.alert(
        `Unable to paste model. Make sure the clipboard contains valid Copy Model JSON.\n\n${getErrorMessage(error, 'Invalid model payload.')}`,
      )
    } finally {
      setIsPastingModel(false)
    }
  }

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
        const width = newestAddedNode.measured?.width || SCHEMA_ENTITY_NODE_WIDTH;
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
        const w = n.measured?.width || SCHEMA_ENTITY_NODE_WIDTH;

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
          <div className="ml-auto flex items-center gap-2">
            {isDevMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => void handleCopyCanvasModel()}
                  className="flex h-11 items-center gap-2 rounded-xl border border-[#ffc4a6] bg-[#fff8f4] px-4 font-bold shadow-sm transition hover:bg-[#fff0e8] text-[#ff7a45] hover:text-[#e66a39]"
                >
                  <Clipboard className="size-4" />
                  Copy Model
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handlePasteCanvasModel()}
                  disabled={isPastingModel}
                  className="flex h-11 items-center gap-2 rounded-xl border border-[#ffc4a6] bg-[#fff8f4] px-4 font-bold shadow-sm transition hover:bg-[#fff0e8] text-[#ff7a45] hover:text-[#e66a39] disabled:opacity-50"
                >
                  <ClipboardPaste className="size-4" />
                  {isPastingModel ? 'Pasting...' : 'Paste Model'}
                </Button>
              </>
            ) : null}
            <Button
              variant="outline"
              onClick={clearCanvas}
              className="flex h-11 items-center gap-2 rounded-xl border border-[#ffb3ad] bg-[#fff0ee] px-4 font-bold shadow-sm transition hover:bg-[#ffe1de] text-[#ff3b30] hover:text-red-600"
            >
              <Trash2 className="size-4" />
              Clear Canvas
            </Button>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
          <div className="relative h-[min(68vh,44rem)] w-[min(52rem,calc(100vw-2rem))]">
            <button
              type="button"
              onClick={() => setIsAiPanelOpen(true)}
              className={`group pointer-events-auto absolute inset-x-0 bottom-0 flex h-[3.9rem] items-center justify-between rounded-[1.6rem] border border-[#ffd8c3] bg-white/95 px-5 text-left shadow-[0_14px_32px_rgba(15,23,42,0.14)] backdrop-blur-md transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] transform-gpu [will-change:transform,opacity] hover:border-[#ffc3a6] hover:bg-white ${
                isAiPanelOpen
                  ? 'pointer-events-none translate-y-2 scale-[0.985] opacity-0'
                  : 'pointer-events-auto translate-y-0 scale-100 opacity-100'
              }`}
              title="Open AI assistant"
            >
              <p className="font-mono text-sm font-normal leading-none tracking-wide text-gray-500">
                Ask for follow-up changes
              </p>

              <div className="flex size-8 items-center justify-center rounded-full bg-[#f2f4f7] text-gray-500 transition group-hover:bg-[#ffefe5] group-hover:text-[#ff7a45]">
                <ArrowUp className="size-4" />
              </div>
            </button>

            <div
              className={`pointer-events-auto absolute inset-x-0 bottom-0 h-[min(68vh,44rem)] origin-bottom overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] transform-gpu [will-change:transform,opacity] ${
                isAiPanelOpen
                  ? 'scale-y-100 opacity-100 translate-y-0'
                  : 'pointer-events-none scale-y-95 opacity-0 translate-y-2'
              }`}
            >
              <div className="h-[min(68vh,44rem)] w-full">
                <UseCasePromptPanel
                  onSchemaBuilt={() => {
                    setIsAiPanelOpen(false)
                    setIsMenuOpen(false)
                  }}
                  onClose={() => setIsAiPanelOpen(false)}
                />
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
