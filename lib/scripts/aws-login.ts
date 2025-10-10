import { execSync } from 'child_process'
import * as path from 'path'
import { AWS_ACCOUNTS } from '../constants/aws'
const profile = `AWSAdministratorAccess-${AWS_ACCOUNTS[process.argv[2]]}`

try {
  // Executing AWS SSO login and yawsso commands
  execSync(`aws sso login --profile ${profile}`, { stdio: 'inherit' })
  execSync(`yawsso -p ${profile}`, { stdio: 'inherit' })

  // Getting the script directory
  const scriptDir = path.dirname(__filename)

  // Outputting the instructions
  console.log(
    `\n\n\nRun this to load the AWS credentials (${profile}) as env vars:\n`
  )
  const BACKGROUND = '\x1b[37;41;1m'
  const NOCOLOR = '\x1b[0m'
  console.log(
    BACKGROUND +
      `source ${scriptDir}/load-credentials.sh ${profile}\n` +
      NOCOLOR
  )
} catch (error) {
  console.error('An error occurred:', error)
}
