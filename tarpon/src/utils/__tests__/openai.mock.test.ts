import { ObjectId } from 'mongodb'
import { GPTLogObject } from '../openai'

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
describe('GPTLog Mock Tests', () => {
  it('should create a mock GPT log with default values', () => {
    const mockLog = createMockGPTLog()
    expect(mockLog._id).toBeDefined()
    expect(mockLog.prompts).toBeDefined()
    expect(mockLog.prompts.messages).toHaveLength(2)
    expect(mockLog.response).toBeDefined()
    expect(mockLog.createdAt).toBeDefined()
  })

  it('should override default values with provided values', () => {
    const customId = new ObjectId()
    const mockLog = createMockGPTLog({
      _id: customId,
      response: 'Custom response',
      createdAt: 1234567890,
    })
    expect(mockLog._id).toEqual(customId)
    expect(mockLog.response).toBe('Custom response')
    expect(mockLog.createdAt).toBe(1234567890)
    // Should preserve default values for non-overridden fields
    expect(mockLog.prompts.messages).toHaveLength(2)
  })

  it('should allow overriding prompts', () => {
    const customPrompts = {
      messages: [{ role: 'user', content: 'Custom prompt' }],
    }
    const mockLog = createMockGPTLog({
      prompts: customPrompts,
    })
    expect(mockLog.prompts).toEqual(customPrompts)
    expect(mockLog.prompts.messages).toHaveLength(1)
  })
})
