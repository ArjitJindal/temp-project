import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { exit } from 'process'

// Get command-line arguments
const args = process.argv.slice(2)
const stage = args[0]
const region = args[1]
const additionalArgs = args.slice(2)

console.log('stage', stage)
console.log('region', region)
exit(0)

if (!stage || !region) {
  console.error('Stage and region are required.')
  process.exit(1)
}

// Check if CDKTF is already initialized
if (existsSync('.gen')) {
  console.log('CDKTF already initialized')
} else {
  console.log('Initializing CDKTF...')
  try {
    execSync('cdktf get --quiet', { stdio: 'inherit' })
  } catch (error) {
    console.error('Failed to initialize CDKTF:', error)
    process.exit(1)
  }
}

// Build Python assets using Poetry
console.log('Building Python assets...')
try {
  execSync('poetry build', { stdio: 'inherit' })
} catch (error) {
  console.error('Failed to build Python assets:', error)
  process.exit(1)
}

// Deploy with CDKTF
console.log(`Deploying to stage: ${stage}, region: ${region}`)
try {
  execSync(
    `STAGE=${stage} REGION=${region} cdktf deploy ${additionalArgs.join(' ')}`,
    {
      stdio: 'inherit',
    }
  )
} catch (error) {
  console.error('Failed to deploy with CDKTF:', error)
  process.exit(1)
}
