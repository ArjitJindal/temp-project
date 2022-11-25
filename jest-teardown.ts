import { execSync } from 'child_process'

module.exports = async function () {
  if (process.env.EXEC_SOURCE !== 'CI') {
    try {
      execSync('docker stop local-dynamodb-test')
    } catch (e) {
      // ignore
    }
    try {
      execSync('docker rm local-dynamodb-test')
    } catch (e) {
      // ignore
    }
  }
}
