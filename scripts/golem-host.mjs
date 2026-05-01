// Phase 0 Golem host runner.
//
// Connects to a locally running yagna daemon, rents a CPU VM on the Golem
// testnet, uploads scripts/golem-vm-server.mjs into the VM, starts it, and
// opens a TCP proxy from the rented VM's port 11434 to localhost:11434.
//
// Once this is running, the Next.js app (with AI_PROVIDER=golem and
// GOLEM_INFERENCE_URL=http://localhost:11434/v1) talks to the rented VM as if
// it were a local OpenAI-compatible endpoint.
//
// Stop with Ctrl-C. The rental ends when the script exits.

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import { GolemNetwork } from '@golem-sdk/golem-js'
import { pinoPrettyLogger } from '@golem-sdk/pino-logger'

const __dirname = dirname(fileURLToPath(import.meta.url))

const env = (key, fallback) => process.env[key] ?? fallback

const appKey = env('YAGNA_APPKEY')
if (!appKey) {
  console.error(
    '[golem-host] YAGNA_APPKEY is not set.\n' +
      '  Create one with:   yagna app-key create arkiv-build\n' +
      '  Then add to .env.local:   YAGNA_APPKEY=<token>',
  )
  process.exit(1)
}

const imageHash = env('GOLEM_IMAGE_HASH')
const imageTag = env('GOLEM_IMAGE_TAG')

if (!imageHash && !imageTag) {
  console.error(
    '[golem-host] No image specified.\n' +
      '  Build and publish the inference image, then add to .env.local:\n' +
      '    GOLEM_IMAGE_HASH=<hash printed by gvmkit-build>\n' +
      '  See docs/golem-poc-runbook.md for the build steps.',
  )
  process.exit(1)
}

const config = {
  appKey,
  paymentNetwork: env('GOLEM_PAYMENT_NETWORK', 'holesky'),
  paymentDriver: env('GOLEM_PAYMENT_DRIVER', 'erc20'),
  imageHash,
  imageTag,
  rentHours: Number(env('GOLEM_RENT_HOURS', '0.5')),
  maxStartPrice: Number(env('GOLEM_MAX_START_PRICE', '0.5')),
  maxCpuPerHourPrice: Number(env('GOLEM_MAX_CPU_PRICE', '1.0')),
  maxEnvPerHourPrice: Number(env('GOLEM_MAX_ENV_PRICE', '0.5')),
  proxyPort: Number(env('GOLEM_PROXY_PORT', '11434')),
  llamaBinary: env('GOLEM_LLAMA_BINARY', '/usr/local/bin/llama-server'),
  modelPath: env('GOLEM_MODEL_PATH', '/models/model.gguf'),
  modelLabel: env('GOLEM_MODEL', 'qwen2.5-0.5b-instruct'),
  minMemGib: Number(env('GOLEM_MIN_MEM_GIB', '2')),
}

const log = (msg) => console.log(`[golem-host] ${msg}`)
const fail = (msg, err) => {
  console.error(`[golem-host] ${msg}`)
  if (err) console.error(err)
  process.exit(1)
}

const baseWorkload = config.imageHash
  ? { imageHash: config.imageHash }
  : { imageTag: config.imageTag }

const buildOrder = (network) => ({
  demand: {
    workload: {
      ...baseWorkload,
      minMemGib: config.minMemGib,
      capabilities: ['vpn'],
    },
  },
  market: {
    rentHours: config.rentHours,
    pricing: {
      model: 'linear',
      maxStartPrice: config.maxStartPrice,
      maxCpuPerHourPrice: config.maxCpuPerHourPrice,
      maxEnvPerHourPrice: config.maxEnvPerHourPrice,
    },
  },
  network,
})

const glm = new GolemNetwork({
  logger: pinoPrettyLogger({ level: 'info' }),
  api: { key: config.appKey },
  payment: { driver: config.paymentDriver, network: config.paymentNetwork },
})

let proxy
let rental
let network
let exiting = false

const cleanup = async (code = 0) => {
  if (exiting) return
  exiting = true
  log('Cleaning up rental, network, and proxy…')
  try {
    await proxy?.close()
  } catch (err) {
    console.error('proxy close error:', err)
  }
  try {
    await rental?.stopAndFinalize()
  } catch (err) {
    console.error('rental finalize error:', err)
  }
  try {
    if (network) await glm.destroyNetwork(network)
  } catch (err) {
    console.error('network destroy error:', err)
  }
  try {
    await glm.disconnect()
  } catch (err) {
    console.error('glm disconnect error:', err)
  }
  process.exit(code)
}

process.on('SIGINT', () => cleanup(0))
process.on('SIGTERM', () => cleanup(0))

const main = async () => {
  const imageDescription = config.imageHash
    ? `imageHash=${config.imageHash}`
    : `imageTag=${config.imageTag}`
  log(`Connecting to yagna (network=${config.paymentNetwork}, ${imageDescription})…`)
  await glm.connect()
  log('Creating VPN network for the rented VM…')
  network = await glm.createNetwork({ ip: '192.168.7.0/24' })
  log('Negotiating with providers…')

  rental = await glm.oneOf({ order: buildOrder(network) })
  const exe = await rental.getExeUnit()

  const providerName = exe.provider?.name ?? 'unknown'
  log(`Rental acquired from provider "${providerName}".`)

  log('Sanity-checking image contents…')
  const sanity = await exe.run(
    `ls -la ${config.llamaBinary} 2>&1; echo "---"; ` +
      `ls -la ${config.modelPath} 2>&1; echo "---"; ` +
      `cat /tmp/llama-paths.txt 2>&1; echo "---"; ` +
      `cat /etc/os-release 2>&1 | head -3`,
  )
  const sanityOut = String(sanity.stdout ?? '')
  log(`[vm:sanity] ${sanityOut.trim().replace(/\n/g, ' | ')}`)

  // If the assumed binary path isn't there, try the first path the build script
  // discovered with `find`.
  let llamaBinary = config.llamaBinary
  if (sanityOut.includes('No such file or directory') && sanityOut.includes('llama-server')) {
    const match = sanityOut.match(/(\/[^ |]*\/llama-server)/)
    if (match) {
      llamaBinary = match[1]
      log(`Adjusted llama-server path to: ${llamaBinary}`)
    }
  }

  const startCommand =
    `${llamaBinary} --host 0.0.0.0 --port ${config.proxyPort} -m ${config.modelPath} ` +
    `--ctx-size 4096 --threads 0`

  log(`Starting llama-server (background): ${startCommand}`)
  await exe.run(
    `nohup ${startCommand} > /tmp/llama.log 2>&1 & echo $! > /tmp/llama.pid && sleep 1 && echo "spawned pid=$(cat /tmp/llama.pid)"`,
  )

  log('Polling for llama-server to bind to the port (loads model on startup)…')
  // llama-server's /health returns 200 once model is loaded and ready.
  let bound = false
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const r = await exe.run(
      `curl -sf -w '\\n%{http_code}' http://localhost:${config.proxyPort}/health 2>&1 || true`,
    )
    const out = String(r.stdout ?? '')
    if (out.includes('200') && out.includes('"status"')) {
      bound = true
      break
    }
  }

  if (!bound) {
    const tail = await exe.run('cat /tmp/llama.log 2>&1 | tail -60; echo "---"; ps -ef 2>&1')
    log(`[vm:llama.log] ${String(tail.stdout ?? '').trim().replace(/\n/g, ' | ')}`)
    throw new Error('llama-server did not become healthy within 90s. See [vm:llama.log] above.')
  }

  log(`Model "${config.modelLabel}" is loaded. Opening TCP proxy…`)

  proxy = exe.createTcpProxy(config.proxyPort)
  await proxy.listen(config.proxyPort)

  log('')
  log(`✓ Proxy ready at http://localhost:${config.proxyPort}/v1`)
  log(`  Model:   ${config.modelLabel}  (real inference via llama.cpp, CPU)`)
  log('  Set these in Next.js .env.local:')
  log(`    AI_PROVIDER=golem`)
  log(`    GOLEM_INFERENCE_URL=http://localhost:${config.proxyPort}/v1`)
  log(`    GOLEM_MODEL=${config.modelLabel}`)
  log('')
  log('Leave this process running. Ctrl-C to release the rental.')
}

main().catch((err) => fail('Host failed to start', err))
