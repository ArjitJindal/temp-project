import fs from 'fs'
import path from 'path'
import { LOGIC_OPERATORS } from '..'

// NOTE: Changing the key of an operator requires a migration
test('keys', async () => {
  const operatorKeys = Object.values(LOGIC_OPERATORS).map((v) => v.key)
  const operators = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'resources', 'operators.json'), 'utf8')
  )
  expect(operatorKeys).toEqual(operators)
})
