import { ObjectId } from 'mongodb'
import { getGPTRequestLogById, GPTLogObject, logGPTResponses } from '../openai'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
export const createMockGPTLog = (
  overrides: Partial<GPTLogObject> = {}
): GPTLogObject => {
  return {
    _id: new ObjectId(),
    prompts: {
      messages: [
        { role: 'user', content: 'Sample prompt' },
        { role: 'assistant', content: 'Sample response' },
      ],
    },
    response: 'Mock GPT response',
    createdAt: Date.now(),
    ...overrides,
  }
}

withFeaturesToggled([], ['CLICKHOUSE_ENABLED', 'CLICKHOUSE_MIGRATION'], () => {
  describe('GPTLog Mock Tests', () => {
    it('should create a mock GPT log with default values', async () => {
      const tenantId = getTestTenantId()
      const mockLog = createMockGPTLog()
      await logGPTResponses(tenantId, mockLog.prompts, mockLog.response)
    })

    it('should get a gpt request log by id', async () => {
      const tenantId = getTestTenantId()
      const mockLog = createMockGPTLog()
      const gptResponse = await logGPTResponses(
        tenantId,
        mockLog.prompts,
        mockLog.response
      )
      const gptRequestLog = await getGPTRequestLogById(
        tenantId,
        gptResponse._id as ObjectId
      )
      expect(gptRequestLog).toBeDefined()
      expect(gptRequestLog?.response).toEqual(mockLog.response)
      expect(gptRequestLog?.prompts).toEqual(mockLog.prompts)
    })
  })
})
