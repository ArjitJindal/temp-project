# tarpon

![tarpons](https://github.com/flagright/tarpon/blob/main/tarpons.png)

Codenamed after the [majestic tarpons](https://youtu.be/wV2CF2WWGFQ).

## Project Structure

- src/lambdas - Code for lambda functions.
- src/services - Code for services which can be used by multiple lambdas.
- events - Invocation events that you can use to invoke the function.
- lib/cdk-tarpon-stack.ts - The CDK configuration of the application's AWS resources.
- lib/cdk-alarms-stack.ts - The CDK configuration of the application's Alarms.

## Prerequisites

- CDK CLI - [Install the CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/cli.html)
- Node.js (v14) - [Install Node.js](https://nodejs.org/en/), including the NPM package management tool.
- Docker - [Install Docker community edition](https://hub.docker.com/search/?type=edition&offering=community)

## Build

```bash
npm install
npm run build
npm run build:local (faster for local build without source maps generation)
```

## Testing Functions Locally

You can test functions locally, ensure you've your SSO configured (including default region - `region` field in `~/.aws/config`) before running.

You will also need to add a `default` profile in `~/.aws/credentials`:

```
[default]
region=us-east-2
aws_access_key_id=false
aws_secret_access_key=false

```

### For first run

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
npm run dev:api:console             # only starts console API
```

Local environment config (ex: tenantID) is stored in `local-dev.ts`.

## Deploy

In order to deploy to a new account (or the first time you're deploying), you have to run `cdk bootstrap` like so:

```
cdk bootstrap --profile <profileName>
```

Then you can deploy to dev like so:

```bash
npm run deploy:dev
```

To deploy to your personal stack for dev:

```bash
GITHUB_USER=<username> S_NO=<1/2/3> npm run deploy:dev:user:clean
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

3. Run the migration with env vars `ENV`, `AWS_REGION`, `SM_SECRET_ARN` being set

```bash
ENV=dev AWS_REGION=eu-central-1 SM_SECRET_ARN='arn:aws:secretsmanager:eu-central-1:911899431626:secret:mongoAtlasCreds-RvzMVI' npm run migration:pre:up
```

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

### Create a New Tenant

### Create a New Tenant

For now, we can use the script `onboard-tarpon-api.sh` to create a new tenant, its usage plan and API key, and it'll create a fixed set of rules if they're not yet created. After this script is run, we need to manually activate the rules for the tenant in the FDT console.

Dev env:

```bash
bash src/scripts/onboard-tarpon-api.sh --tenantName sh-payment --tenantWebsite https://sh-payments.com/ --env dev
```

Sandbox env:

```bash
bash src/scripts/onboard-tarpon-api.sh --tenantName sh-payment --tenantWebsite https://sh-payments.com/ --env sandbox
```

Prod env (need to specify region):

```bash
bash src/scripts/onboard-tarpon-api.sh --tenantName sh-payment --tenantWebsite https://sh-payments.com/ --env prod-asia-1
```

### Creating a new rule

- Create a new function in `rules` folder
- Create a unit test for the rule that covers all cases in `__test__` folder
- Add it to requisite rule list (currently `transaction` or `user` rule types)
- Merge PR and deploy to all environments (Dev, Sandbox and prod regions)
- Launch the rule on console - [Instructions](https://www.notion.so/flagright/Launching-new-Rule-on-Console-51803611658047d79a5a3757fcc8b755)
