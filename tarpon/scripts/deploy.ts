import { execSync } from 'child_process'
const command = process.argv[2]
const env = process.argv[3]
const region = process.argv[4]

try {
  // Executing AWS SSO login and yawsso commands
  execSync(`cdk ${command} ${env}-tarpon --require-approval=never`, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ENV: `${env}${region ? `:${region}` : ''}`,
    },
  })
} catch (error) {
  console.error('An error occurred:', error)
}
