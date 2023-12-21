const fs = require('fs/promises')
const path = require('path')

async function main() {
  const OUTPUT_FILE = process.env.OUTPUT_FILE || 'coverage-stats.json'
  const coverage = await fs.readFile(`coverage/coverage-summary.json`, 'utf-8')
  const coverageJSON = JSON.parse(coverage)
  const totalCoverage = coverageJSON.total
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(totalCoverage, null, 2))
}

main().catch((e) => console.error(e))
