import arkivContextJson from './arkivContext.json'

export type ArkivBestPractice = {
  id: string
  title: string
  rule: string
  rationale: string
}

export type ArkivExamplePattern = {
  id: string
  title: string
  patterns: string[]
}

export type ArkivFitNote = {
  alternative: string
  arkivAdvantage: string
}

export type ArkivContext = {
  network: { default: string; sdkImport: string; notes: string }
  bestPractices: ArkivBestPractice[]
  examplePatterns: ArkivExamplePattern[]
  arkivFitVsAlternatives: ArkivFitNote[]
  implementationPlan: { sections: string[]; mustMention: string[] }
}

export const arkivContext = arkivContextJson as ArkivContext

export const formatBestPracticesForPrompt = () =>
  arkivContext.bestPractices
    .map((practice) => `- ${practice.title}: ${practice.rule}`)
    .join('\n')

export const formatExamplePatternsForPrompt = () =>
  arkivContext.examplePatterns
    .map(
      (example) =>
        `${example.title}:\n${example.patterns.map((pattern) => `  - ${pattern}`).join('\n')}`,
    )
    .join('\n\n')

export const formatArkivFitForPrompt = () =>
  arkivContext.arkivFitVsAlternatives
    .map((note) => `- vs ${note.alternative}: ${note.arkivAdvantage}`)
    .join('\n')

export const formatImplementationPlanRequirements = () => {
  const sections = arkivContext.implementationPlan.sections
    .map((section) => `- ${section}`)
    .join('\n')
  const mustMention = arkivContext.implementationPlan.mustMention
    .map((item) => `- ${item}`)
    .join('\n')

  return `Required sections:\n${sections}\n\nThe plan must explicitly mention:\n${mustMention}`
}

export const formatNetworkContext = () =>
  `Network: ${arkivContext.network.default}\nSDK import: ${arkivContext.network.sdkImport}\n${arkivContext.network.notes}`
