import fs from 'fs'
import path from 'path'
import { DEFAULT_ROLES_V2 } from '@/core/default-roles'

test('keys', async () => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'resources', 'roles.json'), 'utf8')
  )
  expect(DEFAULT_ROLES_V2).toEqual(data)
})
