import {
  CUSTOM_IN_BUILT_GREATER_THAN_OPERATOR,
  CUSTOM_IN_BUILT_GREATER_THAN_OR_EQUAL_TO_OPERATOR,
  CUSTOM_IN_BUILT_IN_ANY_IN_LOGIC_OPERATOR,
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

    expect(
      await CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR.run(1, 2, 3)
    ).toBe(true)

    expect(
      await CUSTOM_IN_BUILT_LESS_THAN_OR_EQUAL_TO_OPERATOR.run(3, 2, 4)
    ).toBe(false)
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

  test('test in operator', async () => {
    const result = await CUSTOM_IN_BUILT_IN_ANY_IN_LOGIC_OPERATOR.run('a', [
      'a',
      'b',
      'c',
    ])
    expect(result).toBe(true)
  })

  test('test in operator with lhs as array and rhs as string', async () => {
    const result = await CUSTOM_IN_BUILT_IN_ANY_IN_LOGIC_OPERATOR.run(
      '1',
      [1, 2, 3]
    )
    expect(result).toBe(true)
  })

  test('test in operator with lhs as array and rhs as array', async () => {
    const result = await CUSTOM_IN_BUILT_IN_ANY_IN_LOGIC_OPERATOR.run(
      '1',
      [4, 1, 6]
    )
    expect(result).toBe(true)
  })

  test('test in operator with number falsy result', async () => {
    const result = await CUSTOM_IN_BUILT_IN_ANY_IN_LOGIC_OPERATOR.run(
      '1',
      [4, 8, 6]
    )
    expect(result).toBe(false)
  })
})
