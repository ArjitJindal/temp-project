import fs from 'fs'
import path from 'path'
import { LOGIC_FUNCTIONS } from '..'

// NOTE: Changing the key of a function requires a migration
test('keys', async () => {
  const functionKeys = Object.values(LOGIC_FUNCTIONS).map((v) => v.key)
  const functions = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'resources', 'functions.json'), 'utf8')
  )
  expect(functionKeys).toEqual(functions)
})
