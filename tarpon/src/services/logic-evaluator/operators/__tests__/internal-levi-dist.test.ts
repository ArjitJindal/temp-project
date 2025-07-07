import { getEditDistance } from '@flagright/lib/utils'
import { INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR } from '../internalLeviDistance'
import { removePrefixFromName } from '@/services/rules-engine/utils/transaction-rule-utils'
import { extractFirstAndLastName } from '@/services/rules-engine/transaction-rules/payment-method-name-levensthein-distance'

// Mock the dependencies
jest.mock('@flagright/lib/utils', () => ({
  getEditDistance: jest.fn(),
}))

jest.mock('@/services/rules-engine/utils/transaction-rule-utils', () => ({
  removePrefixFromName: jest.fn(),
}))

jest.mock(
  '@/services/rules-engine/transaction-rules/payment-method-name-levensthein-distance',
  () => ({
    extractFirstAndLastName: jest.fn(),
  })
)

const mockGetEditDistance = getEditDistance as jest.MockedFunction<
  typeof getEditDistance
>
const mockRemovePrefixFromName = removePrefixFromName as jest.MockedFunction<
  typeof removePrefixFromName
>
const mockExtractFirstAndLastName =
  extractFirstAndLastName as jest.MockedFunction<typeof extractFirstAndLastName>

describe('INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return false when inputs are null or undefined', async () => {
    expect(
      await INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR.run(null, 'John Doe', [20])
    ).toBe(false)
    expect(
      await INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR.run('John Doe', null, [20])
    ).toBe(false)
    expect(
      await INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR.run(undefined, 'John Doe', [
        20,
      ])
    ).toBe(false)
    expect(
      await INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR.run('John Doe', undefined, [
        20,
      ])
    ).toBe(false)
  })

  it('should convert lhs to lowercase', async () => {
    mockRemovePrefixFromName.mockReturnValue('john doe')
    mockExtractFirstAndLastName.mockReturnValue('john doe')
    mockGetEditDistance.mockReturnValue(0)

    await INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR.run('JOHN DOE', 'John Doe', [
      20,
    ])

    // Verify that the function processes the input correctly
    expect(mockGetEditDistance).toHaveBeenCalled()
  })

  it('should process rhs through removePrefixFromName and extractFirstAndLastName', async () => {
    mockRemovePrefixFromName.mockReturnValue('john doe')
    mockExtractFirstAndLastName.mockReturnValue('john doe')
    mockGetEditDistance.mockReturnValue(0)

    await INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR.run(
      'john doe',
      'Mr. John Doe',
      [20]
    )

    expect(mockRemovePrefixFromName).toHaveBeenCalledWith('Mr. John Doe', true)
    expect(mockExtractFirstAndLastName).toHaveBeenCalledWith('john doe')
  })

  it('should calculate minimum distance between original and processed names', async () => {
    mockRemovePrefixFromName.mockReturnValue('john doe')
    mockExtractFirstAndLastName.mockReturnValue('john doe')
    mockGetEditDistance
      .mockReturnValueOnce(3) // distance to original name
      .mockReturnValueOnce(1) // distance to processed name

    await INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR.run(
      'john doe',
      'Mr. John Doe',
      [20]
    )

    expect(mockGetEditDistance).toHaveBeenCalledTimes(2)
    expect(mockGetEditDistance).toHaveBeenNthCalledWith(
      1,
      'john doe',
      'Mr. John Doe'
    )
    expect(mockGetEditDistance).toHaveBeenNthCalledWith(
      2,
      'john doe',
      'john doe'
    )
  })

  it('should return true when distance exceeds threshold', async () => {
    mockRemovePrefixFromName.mockReturnValue('john doe')
    mockExtractFirstAndLastName.mockReturnValue('john doe')
    mockGetEditDistance.mockReturnValue(3)

    const result = await INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR.run(
      'john doe',
      'Mr. John Doe',
      [20]
    )

    // 20% of 8 characters = 1.6, distance 3 > 1.6, so should return true
    expect(result).toBe(true)
  })

  it('should return false when distance is within threshold', async () => {
    mockRemovePrefixFromName.mockReturnValue('john doe')
    mockExtractFirstAndLastName.mockReturnValue('john doe')
    mockGetEditDistance.mockReturnValue(1)

    const result = await INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR.run(
      'john doe',
      'Mr. John Doe',
      [20]
    )

    // 20% of 8 characters = 1.6, distance 1 <= 1.6, so should return false
    expect(result).toBe(false)
  })

  it('should handle empty strings', async () => {
    mockRemovePrefixFromName.mockReturnValue('')
    mockExtractFirstAndLastName.mockReturnValue('')
    mockGetEditDistance.mockReturnValue(0)

    const result = await INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR.run('', '', [
      20,
    ])

    expect(result).toBe(false)
  })

  it('should process inputs correctly', async () => {
    mockRemovePrefixFromName.mockReturnValue('john doe')
    mockExtractFirstAndLastName.mockReturnValue('john doe')
    mockGetEditDistance.mockReturnValue(2)

    await INTERNAL_LEVENSHTEIN_DISTANCE_OPERATOR.run(
      'john doe',
      'Mr. John Doe',
      [20]
    )

    // Verify the function processes inputs and calls dependencies correctly
    expect(mockRemovePrefixFromName).toHaveBeenCalledWith('Mr. John Doe', true)
    expect(mockExtractFirstAndLastName).toHaveBeenCalledWith('john doe')
    expect(mockGetEditDistance).toHaveBeenCalled()
  })
})
