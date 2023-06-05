import fs from 'node:fs'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'

const data: SanctionsSearchResponse[] = []

const init = () => {
  const pathes = [
    './src/core/seed/data/raw-data/search1.json',
    './src/core/seed/data/raw-data/search2.json',
    './src/core/seed/data/raw-data/search3.json',
  ]
  for (const path of pathes) {
    const fileText = fs.readFileSync(path)
    const json: SanctionsSearchResponse = JSON.parse(fileText.toString())
    data.push(json)
  }
}

export { init, data }
