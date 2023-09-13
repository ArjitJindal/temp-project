# tarpon

![tarpons](/tarpon/resources/tarpons.png)

Codenamed after the [majestic tarpons](https://youtu.be/wV2CF2WWGFQ).

## Project Structure

- src/lambdas - Code for lambda functions.
- src/services - Code for services which can be used by multiple lambdas.
- events - Invocation events that you can use to invoke the function.
- lib/cdk-tarpon-stack.ts - The CDK configuration of the application's AWS resources.
- lib/cdk-alarms-stack.ts - The CDK configuration of the application's Alarms.
- lib/cdktf-tarpon-stack.ts - The CDKTF configuration of the application's non-AWS resources.

## Prerequisites

- AWS CLI - [Install AWS CLI](https://aws.amazon.com/cli/)
- CDK CLI - [Install the CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/cli.html)
- Terraform - [Install the Terraform CLI](https://developer.hashicorp.com/terraform/downloads)
- Node.js (v14) - [Install Node.js](https://nodejs.org/en/), including the NPM package management tool.
- Docker - [Install Docker community edition](https://hub.docker.com/search/?type=edition&offering=community)
- [yawsso](https://github.com/victorskl/yawsso) - `pip3 install yawsso`

## Build

```bash
npm install
npm run build
npm run build:local (faster for local build without source maps generation)
```

## Local development

You can test functions locally, ensure you've your SSO configured (including default region - `region` field in `~/.aws/config`) before running.

You will also need to add a `default` profile in `~/.aws/credentials`:

```
[default]
region=us-east-2
aws_access_key_id=false
aws_secret_access_key=false

```

### For first run

Before initial run to configure databases in your local environment make sure you also had configured your AWS credentials in your machine for your local environment. Add following to your `~/.aws/config`:

```bash
[default]
region = us-east-2

[profile AWSAdministratorAccess-911899431626]
sso_start_url = https://d-9a6713bec9.awsapps.com/start#/
sso_region = us-east-2
sso_account_id = 911899431626
sso_role_name = AWSAdministratorAccess
```

Note: If you are unable to find `~/.aws/config` file, you can run `aws configure` and it will create the file for you.

Ensure you have the local instance of DynamoDB & MongoDB running. You need Docker installed and runnable for this. Run this command (with sudo if you're on Linux):

```
npm run dev:databases
```

You can populate your local databases by running (The data will be persistent. You don't need to run it whenever you start the local databases):

```
npm run dev:databases:init
```

If you want to clear and reset your local databases, run:

```
npm run dev:databases:reset
```

Finally, you can start local api:

```
npm run dev:api                     # starts all APIs
npm run dev:api:public              # only starts public API
npm run dev:api:public-management   # only starts public management API
npm run dev:api:public-device-data   # only starts public Device Data API
npm run dev:api:console             # only starts console API
```

_NOTE_:

- The local API server supports hot-reloading, so you don't need to restart the server whenver you make a new change.
- If there're any OpenAPI schema changes, you'll need to run `npm run openapi:build` first to generate Typescript models, otherwise the build could fail.

Local environment config (ex: tenantID) is stored in `local-dev.ts`.

### IDEs

#### VSCode

You can start the local APIs using "Run and Debug" in VSCode, then you can set breakpoints to debug things more easily.
![vscode-debug](/resources/vscode-debug.png)

You can also use JetBrains

## Test

### Unit Tests

Run all the unit tests

```bash
npm run test
```

Run the unit tests related to rules only

```bash
npm run test:rule
npm run test:rule:watch
```

Run the unit tests not related to rules

```bash
npm run test:others
npm run test:others:watch
```

### Integration Tests

#### Introduction

We are having Integrations tests to ensure that the APIs are working as expected. Every API has its own set of integration tests written in `Postman Collection` and stored in `test-resources/` folder.

Collection Link: https://lively-firefly-529317.postman.co/workspace/Flagright-Workspace~7e6e7bab-de2f-4a94-84a0-dca68b5b3d52/collection/24163049-503b80a7-dd73-4ed0-8aa6-5eaaa06f9ea5

#### Running Integration Tests

For Dev environment:

```bash
npm run postman:integration:dev
```

For Sandbox environment:

```bash
npm run postman:integration:sandbox
```

We have integration tests for the following APIs:

- Public API Transactions

#### Sync Postman collection

We can write tests in Postman and sync them to the repo using the following command this will sync the collection to `test-resources/` folder. But only the tests will be synced, not the environment variables. Environment variables are needed to be managed in code as required under `scripts/run-integration-tests.ts`.

```bash
npm run postman:sync:collection
```

## Deploy

In order to deploy to a new account (or the first time you're deploying), you have to run `cdk bootstrap` like so:

```
cdk bootstrap --profile <profileName>
```

Then you can deploy to dev like so:

```bash
npm run deploy:dev
```

To deploy your PR to a QA environment, add a comment on your PR like:

```bash
# To deploy with main Phytoplankton
/deploy

# To deploy against Phytoplankton from a branch
/deploy optional-name-of-branch-in-phytoplankton
```

You can also deploy from local code with the following:

```
yarn run deploy:qa
```

_NOTE_: If it's your first time deploying to your own dev stack. Please follow the instructions below

1. Run `aws configure sso`
2. SSO start URL [None]: `https://d-9a6713bec9.awsapps.com/start#/`
3. SSO Region [None]: us-east-2
4. Select account: `DevsAtFlagright`
5. Select role: `AWSAdministratorAccess`
6. Press enter till the end

### TenantID when running API Locally

- When running the Public API locally (and testing through Postman), tarpon does not check the x-api-key to fetch the tenant ID. You need to set the tenant ID using the request header with key: `tenant-id` and value to the local tenant (`flagright`).

### Fixing common deploy errors by clean deploy

You can run `npm run deploy:dev:clean` to cleanup stuff and create a deployment afresh.

## Cleanup

To delete the sample application that you created, use the AWS CLI. Assuming you used your project name for the stack name, you can run the following:

```bash
aws cloudformation delete-stack --stack-name tarpon
```

## Data Migration

### Creata a new migration script

Create a new migration script to be run before deployment

```bash
npm run migration:pre:create --name=<migration_name>
```

A new migration file will be created in `scripts/migrations/pre-deployment`

Create a new migration script to be run after deployment

```bash
npm run migration:post:create --name=<migration_name>
```

A new migration file will be created in `scripts/migrations/post-deployment`

### Run migrations locally

```bash
ENV=local npm run migration:pre:up
ENV=local npm run migration:post:up
```

### Run migrations in Dev/Sandbox/Prod manually

1. Refresh aws credentials

```
npm run aws-sso-login:dev
```

2. Copy and paste the credentials printed from the previous step to the terminal

```bash
AWS Credentials:
====================================
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...
====================================
```

3. Run the migration with env vars `ENV`, `AWS_REGION`, `ATLAS_CREDENTIALS_SECRET_ARN` being set

```bash
ENV=dev npm run migration:pre:up
```

### Archived migrations

Migrations are periodically deleted (archived). To find the archived migrations, please check the following PRs:

1. https://github.com/flagright/orca/pull/1469

## Resources

### Working with Databases

1. NoSQL Workbench for DynamoDB

   Official GUI client for DynamoDB - https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/workbench.html

2. dynein

   CLI client for DynamoDB - https://github.com/awslabs/dynein

   Example usage:

   ```
   export AWS_PROFILE=AWSAdministratorAccess-911899431626
   dy use Tarpon --region local
   dy query flagright#settings
   ```

3. MongoDB Compass

   Official GUI client for MongoDB - https://www.mongodb.com/products/compass

### Create a new tenant

1. Go to Console
2. Open the super admin panel
3. Switch to the tenant of the target region (e.g 'Flagright (eu-2)')
4. Click "Create New Tenant"
5. Fill the form and click the "Create" button

### Creating a new rule

- Create a new function in `rules` folder
- Create a unit test for the rule that covers all cases in `__test__` folder
- Add it to requisite rule list (currently `transaction` or `user` rule types)
- Merge PR and deploy to all environments (Dev, Sandbox and prod regions)

### Run local rules using production transactions

You can feed your local rules engine with real production transactions by configuring `scripts/debug-rule/config.json` first and run

```bash
npm run verify-remote-transactions
```

Note that whenever the script is run. `Tarpon` dynamodb table will be recreated (then every time you run the script, you'll get the same result).

For example, if you want to use the transactions from tenant A

1. Go to https://console.flagright.com/ and switch the tenant to tenant A using the super admin panel
2. Open 'Network' tab and inspect any console API request
3. Copy the API domain to config.api (e.g https://eu-1.api.flagright.com)
4. Copy the 'Authorization' header (without 'Bearer') value to config.jwt (e.g eyJhbGciOiJSUzI...)
5. Put the transaction IDs into config.transactionIds
6. Start your local tarpon public api (`npm run dev:api:public`)
7. Start your local phytoplankton
8. Configure the rules you want to run in your local Console
9. Run `npm run verify-remote-transactions`

- The rules result for the transactions will be saved in `scripts/debug-rule/.output/`
