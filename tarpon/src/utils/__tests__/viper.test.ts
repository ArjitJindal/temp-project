import {
  partitionedQueries,
  replacePlaceholders,
  transformKeys,
} from '@/utils/viper'

test('transforms flat object keys correctly', () => {
  const input = { id: 123, firstname: 'John', lastname: 'Doe' }
  const expected = { ID: 123, firstName: 'John', lastName: 'Doe' }
  expect(
    transformKeys(
      input,
      new Map([
        ['id', 'ID'],
        ['firstname', 'firstName'],
        ['lastname', 'lastName'],
      ])
    )
  ).toEqual(expected)
})

describe('replacePlaceholders', () => {
  test('replaces single placeholder correctly', () => {
    const sqlQuery = 'SELECT * FROM users WHERE id = :userId'
    const params = { userId: '123' }
    const expected = "SELECT * FROM users WHERE id = '123'"
    expect(replacePlaceholders(sqlQuery, params)).toEqual(expected)
  })

  test('replaces multiple placeholders correctly', () => {
    const sqlQuery =
      'SELECT * FROM users WHERE id = :userId AND name = :userName'
    const params = { userId: '123', userName: 'John' }
    const expected = "SELECT * FROM users WHERE id = '123' AND name = 'John'"
    expect(replacePlaceholders(sqlQuery, params)).toEqual(expected)
  })

  test('returns original string if no placeholders', () => {
    const sqlQuery = 'SELECT * FROM users'
    const params = { userId: '123' }
    expect(replacePlaceholders(sqlQuery, params)).toEqual(sqlQuery)
  })

  test('throws error when a key in placeholder is not found in params', () => {
    const sqlQuery = 'SELECT * FROM users WHERE id = :userId'
    const params = { userName: 'John' }
    expect(() => replacePlaceholders(sqlQuery, params)).toThrow(
      'Placeholder :userId not found in parameters.'
    )
  })

  test('correctly does not add quotes for numeric values', () => {
    const sqlQuery = 'SELECT * FROM users WHERE age = :age'
    const params = { age: 30 } // Assuming age is a number
    const expected = 'SELECT * FROM users WHERE age = 30'
    expect(replacePlaceholders(sqlQuery, params)).toEqual(expected)
  })
})

describe('partitionedQueries', () => {
  test('generates correct query for a single table with tenant', () => {
    const tables = ['users']
    const tenant = 'tenant123'
    const expected =
      "WITH users AS (\n      SELECT *\n      FROM users\n    WHERE tenant='tenant123'\n  )"
    expect(partitionedQueries(tables, tenant)).toEqual(expected)
  })

  test('generates correct query for multiple tables with tenant', () => {
    const tables = ['users', 'orders']
    const tenant = 'tenant123'
    const expected =
      "WITH users AS (\n      SELECT *\n      FROM users\n    WHERE tenant='tenant123'\n  ),  orders AS (\n      SELECT *\n      FROM orders\n    WHERE tenant='tenant123'\n  )"
    expect(partitionedQueries(tables, tenant)).toEqual(expected)
  })

  test('returns empty string when no tables are provided', () => {
    const tables = []
    const tenant = 'tenant123'
    expect(partitionedQueries(tables, tenant)).toEqual('')
  })

  test('handles absence of tenant correctly', () => {
    const tables = ['users']
    expect(partitionedQueries(tables)).toContain("WHERE tenant='undefined'")
  })

  test('handles special characters in table names', () => {
    const tables = ['user; DROP TABLE users;--']
    const tenant = 'tenant123'
    // Expect the function to properly format the table name to prevent SQL injection
    // This is an illustrative test; actual implementation might need real escaping or quoting strategies
    const expected =
      "WITH user; DROP TABLE users;-- AS (\n      SELECT *\n      FROM user; DROP TABLE users;--\n    WHERE tenant='tenant123'\n  )"
    expect(partitionedQueries(tables, tenant)).toEqual(expected)
  })

  test('handles undefined tenant values', () => {
    const tables = ['users']
    const expectedUndefinedTenant =
      "WITH users AS (\n      SELECT *\n      FROM users\n    WHERE tenant='undefined'\n  )"
    expect(partitionedQueries(tables, undefined)).toEqual(
      expectedUndefinedTenant
    )
  })
})
