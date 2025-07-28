#!/usr/bin/env node

/* eslint-disable */
const execSync = require('child_process').execSync;
const fs = require('fs');
const path = require('path');

const TARPON_PATH = path.resolve(__dirname, '..', '..', 'tarpon');
const SOURCE_OPENAPI_INTERNAL_PATH = path.resolve(
  TARPON_PATH,
  'dist',
  'openapi',
  'internal',
  'openapi-internal-original.yaml',
);
const OUTPUT_OPENAPI_INTERNAL_PATH = path.resolve(__dirname, '..', 'config', 'openapi.yaml');

function removeBadImports(paths) {
  for (const path of paths) {
    if (!fs.existsSync(path)) {
      continue;
    }
    const newText = fs
      .readFileSync(path)
      .toString()
      .replace(/import \{ \S+ \| \S+ .*/g, '');
    fs.writeFileSync(path, newText);
  }
}

function replaceUserSavedPaymentDetails(paths) {
  for (const path of paths) {
    if (!fs.existsSync(path)) {
      continue;
    }

    const newText = fs
      .readFileSync(path)
      .toString()
      .replace(
        "import { CardDetails | GenericBankAccountDetails | IBANDetails | ACHDetails | SWIFTDetails | MpesaDetails | UPIDetails | WalletDetails | CheckDetails | CashDetails | NPPDetails } from './CardDetails | GenericBankAccountDetails | IBANDetails | ACHDetails | SWIFTDetails | MpesaDetails | UPIDetails | WalletDetails | CheckDetails | CashDetails | NPPDetails';",
        '',
      );
    fs.writeFileSync(path, newText);
  }
}

function replaceWorkflow(paths) {
  for (const path of paths) {
    if (!fs.existsSync(path)) {
      continue;
    }

    const newText = fs
      .readFileSync(path)
      .toString()
      .replace(
        "import { CaseWorkflow | AlertWorkflow | RiskLevelApprovalWorkflow | RuleApprovalWorkflow } from './CaseWorkflow | AlertWorkflow | RiskLevelApprovalWorkflow | RuleApprovalWorkflow';",
        '',
      );

    fs.writeFileSync(path, newText);
  }
}

function replaceWorkflowDefaultApi(paths) {
  for (const path of paths) {
    if (!fs.existsSync(path)) {
      continue;
    }

    const newText = fs
      .readFileSync(path)
      .toString()
      .replace(
        "import { CaseWorkflow | AlertWorkflow | RiskLevelApprovalWorkflow | RuleApprovalWorkflow } from '../models/CaseWorkflow | AlertWorkflow | RiskLevelApprovalWorkflow | RuleApprovalWorkflow';",
        '',
      );

    fs.writeFileSync(path, newText);
  }
}

function replacePermission(paths) {
  for (const path of paths) {
    if (!fs.existsSync(path)) {
      continue;
    }

    const newText = fs
      .readFileSync(path)
      .toString()
      .replace(
        "import { StaticPermissionsNode | DynamicPermissionsNode } from './StaticPermissionsNode | DynamicPermissionsNode';",
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
        "import { SimulationRiskLevelsJob | SimulationBeaconJob | V8RiskSimulationJob } from './SimulationRiskLevelsJob | SimulationBeaconJob | V8RiskSimulationJob';",
        '',
      )
      .replace(
        "import { SimulationRiskLevelsJob | SimulationBeaconJob | V8RiskSimulationJob } from '../models/SimulationRiskLevelsJob | SimulationBeaconJob | V8RiskSimulationJob';",
        '',
      )
      .replace(
        "import { SimulationBeaconType | SimulationV8RiskFactorsType } from './SimulationBeaconType | SimulationV8RiskFactorsType';",
        'import { SimulationBeaconType } from "../models/SimulationBeaconType"; import { SimulationV8RiskFactorsType } from "../models/SimulationV8RiskFactorsType";',
      )
      .replace(
        "import { SimulationRiskLevelsAndRiskFactorsResult | SimulationBeaconTransactionResult | SimulationBeaconResultUser } from './SimulationRiskLevelsAndRiskFactorsResult | SimulationBeaconTransactionResult | SimulationBeaconResultUser';",
        '',
      );

    fs.writeFileSync(path, newText);
  }
}

function exec(command, cwd) {
  execSync(command, { env: process.env, cwd });
}

async function prepare() {
  if (!fs.existsSync(SOURCE_OPENAPI_INTERNAL_PATH)) {
    console.log('Building Tarpot SDK...');
    exec('yarn && yarn openapi:build && yarn openapi:prepare', TARPON_PATH);
  } else {
    exec('yarn && yarn openapi:prepare', TARPON_PATH);
  }
  fs.copyFileSync(SOURCE_OPENAPI_INTERNAL_PATH, OUTPUT_OPENAPI_INTERNAL_PATH);
}

async function generate() {
  exec('rm -rf src/apis');

  exec(
    'yarn exec openapi-generator-cli generate -- -i config/openapi.yaml -g typescript -o src/apis --additional-properties=modelPropertyNaming=original --template-dir build/openapi_generate_templates/overrides',
  );

  exec('mkdir -p /tmp/flagright/phytoplankton || true');

  exec(
    'yarn exec openapi-generator-cli generate -- -i config/openapi.yaml -g typescript -o /tmp/flagright/phytoplankton --additional-properties=modelPropertyNaming=original --template-dir build/openapi_generate_templates/custom',
  );

  exec('mv /tmp/flagright/phytoplankton/models src/apis/models-custom');

  exec(`if [ "$(uname)" = "Darwin" ]; then
sed -i '' "s/\* as URLParse/URLParse/g" src/apis/http/http.ts
sed -i '' "s/private url: URLParse/private url: URLParse<Record<string, string | undefined>>/g" src/apis/http/http.ts
elif [ "$(expr substr $(uname -s) 1 5)" = "Linux" ]; then
sed -i "s/\* as URLParse/URLParse/g" src/apis/http/http.ts
sed -i "s/private url: URLParse/private url: URLParse<Record<string, string | undefined>>/g" src/apis/http/http.ts
fi`);

  const pathsToReplace = [
    'src/apis/models/InternalConsumerUser.ts',
    'src/apis/models/User.ts',
    'src/apis/models/UserOptional.ts',
    'src/apis/models/UserWithRulesResult.ts',
    'src/apis/models/Business.ts',
    'src/apis/models/InternalBusinessUser.ts',
    'src/apis/models/InternalUser.ts',
    'src/apis/models/InternalBusinessUser.ts',
    'src/apis/models/BusinessOptional.ts',
    'src/apis/models/BusinessWithRulesResult.ts',
    'src/apis/models/BatchBusinessUserWithRulesResult.ts',
    'src/apis/models/BatchConsumerUserWithRulesResult.ts',
  ];

  removeBadImports(['src/apis/models/QuestionVariable.ts']);

  replaceUserSavedPaymentDetails(pathsToReplace);
  replacePermission([
    'src/apis/models/PermissionsNodeBase.ts',
    'src/apis/models/DynamicPermissionsNode.ts',
    'src/apis/models/StaticPermissionsNode.ts',
    'src/apis/models/PermissionsResponse.ts',
  ]);
  replaceSimulationGetResponse([
    'src/apis/apis/DefaultApi.ts',
    'src/apis/models/SimulationGetResponse.ts',
    'src/apis/models/SimulationRiskLevelsAndRiskFactorsResultResponse.ts',
  ]);
  replaceWorkflow(['src/apis/models/WorkflowResponse.ts']);
  replaceWorkflowDefaultApi(['src/apis/apis/DefaultApi.ts']);

  exec('npx prettier --write src/apis');
}

async function main() {
  await prepare();
  await generate();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
