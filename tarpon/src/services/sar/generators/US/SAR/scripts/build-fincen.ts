// Build fincen binary and
// e.g ts-node src/services/sar/generators/US/SAR/scripts/build-fincen.ts

import { execSync } from 'child_process'
import path from 'path'
import * as fs from 'fs'

const fincenBin = path.join(__dirname, '..', 'bin')
const goPath = execSync('go env GOPATH').toString().split('\n')[0]

execSync(
  `GOOS=darwin GOARCH=amd64 go install github.com/moov-io/fincen/cmd/fincen@master`
)
execSync(
  `GOOS=linux GOARCH=amd64 go install github.com/moov-io/fincen/cmd/fincen@master`
)

if (!fs.existsSync(fincenBin)) {
  fs.mkdirSync(fincenBin)
}
fs.copyFileSync(
  path.join(goPath, 'bin', 'darwin_amd64', 'fincen'),
  path.join(fincenBin, 'fincen-amd64-darwin')
)
fs.copyFileSync(
  path.join(goPath, 'bin', 'linux_amd64', 'fincen'),
  path.join(fincenBin, 'fincen-amd64-linux')
)
