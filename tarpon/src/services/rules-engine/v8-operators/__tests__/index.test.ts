import fs from 'fs'
import path from 'path'
import { RULE_OPERATORS } from '..'

// NOTE: Changing the key of an operator requires a migration
test('keys', async () => {
  const operatorKeys = Object.values(RULE_OPERATORS).map((v) => v.key)
  const operators = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'resources', 'operators.json'), 'utf8')
  )
  expect(operatorKeys).toEqual(operators)
})
