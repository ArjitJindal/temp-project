# Phytoplankton-Console

![Phytoplankton](https://github.com/flagright/phytoplankton-console/blob/main/phytoplankton.jpeg)

Named after the saviors of the environment, [Phytoplankton](https://www.youtube.com/watch?v=fS422O4SLc4)

## Flagright back office console

This project is initialized with Ant Design.

## Prerequisites

- AWS CLI - [Install AWS CLI](https://aws.amazon.com/cli/)
- CDK CLI - [Install the CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/cli.html)management tool.offering=community)
- [yawsso](https://github.com/victorskl/yawsso) - `pip3 install yawsso`

## Prepare Environment

Install `node_modules`:

```bash
yarn
```

### Clean up caches

When switching between branches, the local `umi` caches can wreck the build. In order to clean the cache, run:

```bash
yarn clear
```

## Console API

### SDK Generation

1. `yarn openapi:build` - generates API SDK and models under `src/apis/` using the schema from tarpon origin/main
2. `ENV=local yarn openapi:build` - using the schema from your local tarpon (run `npm run openapi:prepare` in tarpon first)
3. `BRANCH=<tarpon-branch-name> yarn openapi:build` - using the schema from the branch of your tarpon PR (automatically published after a PR is created)

_NOTE: DO NOT manually modify the files under `src/apis/` as they are auto-generated (exceptions for now: `models/Transaciont.ts`, `models/TransactionWithRulesResult.ts`, `models/TransactionCaseManagement.ts`)_

### API Usage

In a react component, use the API hook to call the APIs.

Example:

```typescript
import { useApi } from '@/api';
const api = useApi();
const response = await api.getTransactionsList();
```

## Starting Phytoplankton

Assuming you have nvm and yarn installed:

```
> yarn
> nvm use 12
> yarn dev
```

## Running It Locally With Tarpon API

Setup [tarpon](https://github.com/flagright/tarpon) package in you local. Set up steps and running tarpon locally in the [Tarpon README] (https://github.com/flagright/tarpon#tarpon).

Summary, after Tarpon dependencies are setup (including local DDB instance and MongoDB), in the `tarpon` repo:

1. `npm run start-local-ddb`
2. `npm run start-local-mongodb`
3. `npm run synth:local`
4. `npm run start-local-api`

### Deployment

You can deploy to dev using something like:

```bash
npm run deploy:dev:clean
```

To deploy to your stack for dev:

```bash
GITHUB_USER=<username> S_NO=<1/2/3> npm run deploy:dev:user:clean
```

## Integration Tests

In order for integration tests to work, you need to have a cypress env file: `cypress.env.json` with the username and password of the integration test account. You can find this in 1Password shared workspace under `Cypress Test User`.

### Visual Testing

For running integs locally, install Cypress and run `npm run cypress:open`. This will open the Cypress window, choose your browser engine and manually run the test.

### Test in Command line

For testing in command line itself, run: `npm run cypress:test:dev`.
