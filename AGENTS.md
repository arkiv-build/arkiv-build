<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Structure

- `src/app/`: Next.js App Router entrypoints, layouts, and global styles.
- `src/components/`: Reusable React components, including custom React Flow nodes.
- `src/components/ui/`: Shadcn UI primitives and shared styled controls.
- `src/store/`: Zustand stores for client-side state such as schema nodes and edges.
- `src/lib/`: Shared utility helpers.

# Current Frontend Layout

- The main visual schema modeler canvas lives in `src/app/page.tsx`.
- The custom React Flow entity node lives in `src/components/EntityNode.tsx`.
- The schema canvas state lives in `src/store/useSchemaStore.ts`.

# Working Rules

- Keep interactive canvas code in Client Components using `"use client"` where required.
- Prefer adding new visual modeler UI under `src/components/` and new shared state under `src/store/`.
- Preserve the App Router structure under `src/app/` rather than adding legacy `pages/` routes.

## Code style
- TypeScript strict mode
- Single quotes, no semicolons
- Use functional patterns where possible
- Prefer named exports over default exports