import { exit } from 'process'
import { execSync } from 'child_process'

const main = async () => {
  const env = process.argv[2]

  if (!env) {
    console.info(`
Usage: yarn deploy:cdktf <stage:region>

Example:
  yarn deploy:cdktf dev:eu1
  yarn deploy:cdktf sandbox:asia-1

Defaulting to 'dev' stage and 'eu-1' region...
          `)
  }
  const selectedEnv = env || 'dev:eu-1'

  const command = `ENV='${selectedEnv}' ASSUME_ROLE_ARN='' cdktf deploy --quiet --auto-approve`

  execSync(command, { stdio: 'inherit' })
}

void main()
  .then(() => exit(0))
  .catch((e) => {
    console.error(e)
    exit(1)
  })
