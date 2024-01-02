import { renameFeatureFlags } from '../utils/tenant'

export const up = async () => {
  await renameFeatureFlags({
    COPILOT: 'NARRATIVE_COPILOT',
    INVESTIGATIVE_COPILOT: 'AI_FORENSICS',
    ESCALATION: 'ADVANCED_WORKFLOWS',
  })
}
export const down = async () => {
  // skip
}
