import {
  CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR,
  CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR,
  CUSTOM_IN_BUILT_LESS_THAN_OPERATOR,
  CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR,
} from '../custom-built-in-operators'

describe('custom-built-in-operators', () => {
  test('test > operator', async () => {
    const result = await CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR.run(5, 3)
    expect(result).toBe(true)

    const result2 = await CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR.run(3, 5)
    expect(result2).toBe(false)

    const result3 = await CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR.run(5, 5)
    expect(result3).toBe(false)

    const result4 = await CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR.run(null, 3)
    expect(result4).toBe(false)

    const result5 = await CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR.run(3, null)
    expect(result5).toBe(false)
  })
  test('test < operator', async () => {
    const result = await CUSTOM_IN_BUILT_LESS_THAN_OPERATOR.run(3, 5)
    expect(result).toBe(true)

    const result2 = await CUSTOM_IN_BUILT_LESS_THAN_OPERATOR.run(5, 3)
    expect(result2).toBe(false)

    const result3 = await CUSTOM_IN_BUILT_LESS_THAN_OPERATOR.run(5, 5)
    expect(result3).toBe(false)

    const result4 = await CUSTOM_IN_BUILT_LESS_THAN_OPERATOR.run(null, 3)
    expect(result4).toBe(false)

    const result5 = await CUSTOM_IN_BUILT_LESS_THAN_OPERATOR.run(3, null)
    expect(result5).toBe(false)
  })
  test('test <= operator', async () => {
    const result = await CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR.run(
      3,
      5
    )
    expect(result).toBe(true)

    const result2 = await CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR.run(
      5,
      3
    )
    expect(result2).toBe(false)

    const result3 = await CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR.run(
      5,
      5
    )
    expect(result3).toBe(true)

    const result4 = await CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR.run(
      null,
      3
    )
    expect(result4).toBe(false)

    const result5 = await CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR.run(
      3,
      null
    )
    expect(result5).toBe(false)
  })
  test('test >= operator', async () => {
    const result = await CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR.run(
      5,
      3
    )
    expect(result).toBe(true)

    const result2 = await CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR.run(
      3,
      5
    )
    expect(result2).toBe(false)

    const result3 = await CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR.run(
      5,
      5
    )
    expect(result3).toBe(true)

    const result4 = await CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR.run(
      null,
      3
    )
    expect(result4).toBe(false)

    const result5 = await CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR.run(
      3,
      null
    )
    expect(result5).toBe(false)
  })
})
