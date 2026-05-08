# Arkiv Build

Arkiv Build is a visual canvas for designing Arkiv entity schemas quickly.

It makes Arkiv DB structure prototyping easier by letting you:
- Create draft entities visually
- Define indexed attributes and entity data without manual schema wiring
- Connect entity relationships on-canvas
- Deploy to Arkiv DB with one click
- Load wallet-owned entities and iterate before deployment
- Edit deployed entities

## Run Locally

```bash
git clone https://github.com/arkiv-build/arkiv-build
cd arkiv-build
npm install
npm run dev
```

Open `http://localhost:3000`.

### Optional Debug Flag

Set `NEXT_PUBLIC_ENABLE_CHAT_DEBUG_TOOLS=true` to show a development-only `Copy Thread` button in the Arkiv Build Agent panel for exporting full chat JSON during debugging.

## Why Use It

You can model, connect, and refine Arkiv entities visually, then move to deployment with much faster feedback.
