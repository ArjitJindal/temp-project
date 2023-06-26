#!/usr/bin/env node

/* eslint-disable */
const execSync = require('child_process').execSync;
const fs = require('fs');

function exec(command) {
  execSync(command, { env: process.env });
}

exec('rm -rf src/apis');

exec(
  'yarn exec openapi-generator-cli generate -- -i ../tarpon/dist/openapi/internal/openapi-internal-original.yaml -g typescript -o src/apis --additional-properties=modelPropertyNaming=original --template-dir build/openapi_generate_templates/overrides',
);

exec('mkdir -p /tmp/flagright/phytoplankton || true');

exec(
  'yarn exec openapi-generator-cli generate -- -i ../tarpon/dist/openapi/internal/openapi-internal-original.yaml -g typescript -o /tmp/flagright/phytoplankton --additional-properties=modelPropertyNaming=original --template-dir build/openapi_generate_templates/custom',
);

exec('mv /tmp/flagright/phytoplankton/models src/apis/models-custom');

exec(`if [ "$(uname)" = "Darwin" ]; then
sed -i '' "s/\* as URLParse/URLParse/g" src/apis/http/http.ts
sed -i '' "s/private url: URLParse/private url: URLParse<Record<string, string | undefined>>/g" src/apis/http/http.ts
elif [ "$(expr substr $(uname -s) 1 5)" = "Linux" ]; then
sed -i "s/\* as URLParse/URLParse/g" src/apis/http/http.ts
sed -i "s/private url: URLParse/private url: URLParse<Record<string, string | undefined>>/g" src/apis/http/http.ts
fi`);

function replaceUserSavedPaymentDetails(paths) {
  for (const path of paths) {
    if (!fs.existsSync(path)) {
      return;
    }
    const newText = fs
      .readFileSync(path)
      .toString()
      .replace(
        "import { CardDetails | GenericBankAccountDetails | IBANDetails | ACHDetails | SWIFTDetails | MpesaDetails | UPIDetails | WalletDetails | CheckDetails } from './CardDetails | GenericBankAccountDetails | IBANDetails | ACHDetails | SWIFTDetails | MpesaDetails | UPIDetails | WalletDetails | CheckDetails';",
        '',
      );
    fs.writeFileSync(path, newText);
  }
}

function replaceSimulationGetResponse(paths) {
  for (const path of paths) {
    if (!fs.existsSync(path)) {
      continue;
    }
    const newText = fs
      .readFileSync(path)
      .toString()
      .replace(
        "import { SimulationPulseJob | SimulationBeaconJob } from './SimulationPulseJob | SimulationBeaconJob';",
        '',
      )
      .replace(
        "import { SimulationPulseJob | SimulationBeaconJob } from '../models/SimulationPulseJob | SimulationBeaconJob';",
        '',
      )
      .replace(
        "import { SimulationPulseType | SimulationBeaconType } from '../models/SimulationPulseType | SimulationBeaconType';",
        'import { SimulationPulseType } from "../models/SimulationPulseType"; import { SimulationBeaconType } from "../models/SimulationBeaconType";',
      );

    fs.writeFileSync(path, newText);
  }
}

const pathsToReplace = [
  'src/apis/models/Business.ts',
  'src/apis/models/InternalBusinessUser.ts',
  'src/apis/models/InternalUser.ts',
  'src/apis/models/InternalBusinessUser.ts',
  'src/apis/models/BusinessOptional.ts',
  'src/apis/models/BusinessWithRulesResult.ts',
  'src/apis/models/BusinessResponse.ts',
];

replaceUserSavedPaymentDetails(pathsToReplace);

replaceSimulationGetResponse([
  'src/apis/apis/DefaultApi.ts',
  'src/apis/models/SimulationGetResponse.ts',
]);

exec('npx prettier --write src/apis');
