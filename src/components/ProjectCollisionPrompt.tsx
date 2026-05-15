'use client'

import { AlertTriangle, Layers, X } from 'lucide-react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { useArkivStore } from '@/store/useArkivStore'
import { useSchemaStore } from '@/store/useSchemaStore'

const shortAddress = (value?: string) =>
  value ? `${value.slice(0, 6)}...${value.slice(-4)}` : 'another wallet'

const createSuggestedProjectAttributeValue = (value: string) => {
  const baseValue = value.trim() || 'project'
  const baseWithoutSuffix = baseValue.replace(/_[a-z0-9]{4,6}$/i, '')

  return `${baseWithoutSuffix}_draft1`
}

export function ProjectCollisionPrompt() {
  const prompt = useArkivStore((state) => state.projectCollisionPrompt)
  const loadingSelectedEntity = useArkivStore((state) => state.loadingSelectedEntity)
  const loadProjectEntitiesIntoCanvas = useArkivStore(
    (state) => state.loadProjectEntitiesIntoCanvas,
  )
  const dismissProjectCollisionPrompt = useArkivStore(
    (state) => state.dismissProjectCollisionPrompt,
  )
  const ignoreProjectCollisionPrompt = useArkivStore(
    (state) => state.ignoreProjectCollisionPrompt,
  )
  const activeDraftNodeId = useSchemaStore((state) => {
    const activeNode = state.getActiveNode()

    return activeNode?.data.mode === 'draft' ? activeNode.id : undefined
  })
  const setProjectAttributeForConnectedDrafts = useSchemaStore(
    (state) => state.setProjectAttributeForConnectedDrafts,
  )

  if (!prompt) {
    return null
  }

  const entityNoun = prompt.entities.length === 1 ? 'entity' : 'entities'
  const suggestedProjectAttribute = createSuggestedProjectAttributeValue(
    prompt.projectAttributeValue,
  )
  const updateProjectAttribute = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const projectAttributeValue = String(formData.get('projectAttribute') ?? '').trim()

    if (!activeDraftNodeId || !projectAttributeValue) {
      return
    }

    setProjectAttributeForConnectedDrafts(activeDraftNodeId, projectAttributeValue)
    dismissProjectCollisionPrompt()
  }
  const accent = prompt.sameCreator
    ? {
        ring: 'ring-orange-200/70',
        iconBg: 'bg-gradient-to-br from-orange-100 to-orange-200/60',
        iconColor: 'text-[#ff7a45]',
        glow: 'shadow-orange-500/20',
        chip: 'bg-orange-50 text-[#ff7a45] ring-1 ring-inset ring-orange-200',
      }
    : {
        ring: 'ring-rose-200/70',
        iconBg: 'bg-gradient-to-br from-rose-100 to-rose-200/60',
        iconColor: 'text-rose-600',
        glow: 'shadow-rose-500/20',
        chip: 'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200',
      }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-collision-title"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center px-4 animate-in fade-in duration-200"
    >
      <button
        type="button"
        aria-label="Dismiss project collision prompt"
        onClick={dismissProjectCollisionPrompt}
        className="absolute inset-0 cursor-default bg-gray-950/20 backdrop-blur-[2px]"
      />

      <div
        className={[
          'relative w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-xl',
          'ring-1',
          accent.ring,
          accent.glow,
          'animate-in fade-in zoom-in-95 duration-200',
        ].join(' ')}
      >
        <div
          aria-hidden
          className={[
            'pointer-events-none absolute inset-x-0 top-0 h-px',
            prompt.sameCreator
              ? 'bg-gradient-to-r from-transparent via-orange-300/70 to-transparent'
              : 'bg-gradient-to-r from-transparent via-rose-300/70 to-transparent',
          ].join(' ')}
        />

        <button
          type="button"
          aria-label="Dismiss project collision prompt"
          onClick={dismissProjectCollisionPrompt}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={[
              'flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-white/60',
              accent.iconBg,
              accent.iconColor,
            ].join(' ')}
          >
            {prompt.sameCreator ? (
              <Layers className="size-5" />
            ) : (
              <AlertTriangle className="size-5" />
            )}
          </div>

          <div className="min-w-0 flex-1 pr-6">
            <p
              id="project-collision-title"
              className="font-mono text-[11px] font-bold uppercase tracking-widest text-gray-500"
            >
              Project name already exists
            </p>

            <div className="mt-2 flex items-center gap-2">
              <span
                className={[
                  'inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 font-mono text-sm font-bold',
                  accent.chip,
                ].join(' ')}
              >
                {prompt.projectAttributeValue}
              </span>
            </div>

            {prompt.sameCreator ? (
              <p className="mt-4 text-sm leading-6 text-gray-700">
                You already have{' '}
                <span className="font-semibold text-gray-950">
                  {prompt.entities.length} {entityNoun}
                </span>{' '}
                with this project name. Load them into the canvas instead of
                deploying duplicates.
              </p>
            ) : (
              <p className="mt-4 text-sm leading-6 text-gray-700">
                Another user is already using this project name from{' '}
                <span className="font-mono font-bold text-gray-950">
                  {shortAddress(prompt.otherCreator)}
                </span>
                . Change the project value to avoid query collisions.
              </p>
            )}
          </div>
        </div>

        <form
          onSubmit={updateProjectAttribute}
          className="mt-6 rounded-xl border border-gray-100 bg-gray-50/70 p-3"
        >
          <label
            htmlFor="project-collision-project-attribute"
            className="font-mono text-[11px] font-bold uppercase tracking-widest text-gray-400"
          >
            Project attribute
          </label>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="project-collision-project-attribute"
              name="projectAttribute"
              defaultValue={suggestedProjectAttribute}
              className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 font-mono text-xs text-gray-900 outline-none transition focus:border-gray-300 focus:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="project_slug_acme_7x9k"
              disabled={!activeDraftNodeId}
            />

            <Button
              type="submit"
              size="sm"
              disabled={!activeDraftNodeId}
              className="h-10 rounded-xl bg-[#1a1a1a] px-4 font-mono text-xs font-bold uppercase tracking-widest text-white shadow-sm hover:bg-[#333] disabled:opacity-70"
            >
              Update attribute
            </Button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={ignoreProjectCollisionPrompt}
            className="h-10 rounded-xl border-gray-200 bg-white px-4 font-mono text-xs font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Ignore
          </Button>

          {prompt.sameCreator ? (
            <>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  loadProjectEntitiesIntoCanvas(prompt.projectAttributeValue, {
                    keepCurrentCanvas: true,
                  })
                }
                disabled={loadingSelectedEntity}
                className="h-10 rounded-xl bg-[#ff7a45] px-4 font-mono text-xs font-bold uppercase tracking-widest text-white shadow-sm hover:bg-[#ff692a] disabled:opacity-70"
              >
                {loadingSelectedEntity ? 'Loading...' : 'Keep and load entities'}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => loadProjectEntitiesIntoCanvas(prompt.projectAttributeValue)}
                disabled={loadingSelectedEntity}
                className="h-10 rounded-xl bg-[#1a1a1a] px-4 font-mono text-xs font-bold uppercase tracking-widest text-white shadow-sm hover:bg-[#333] disabled:opacity-70"
              >
                {loadingSelectedEntity ? 'Loading...' : 'Load entities'}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
