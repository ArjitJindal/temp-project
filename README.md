# Phytoplankton-Console

![Phytoplankton](https://github.com/flagright/phytoplankton-console/blob/main/phytoplankton.jpeg)

Named after the saviors of the environment, [Phytoplankton](https://www.youtube.com/watch?v=fS422O4SLc4)

## Flagright back office console

This project is initialized with Ant Design.

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

1. `yarn openapi:fetch` - follow the instructions to update `config/openapi.yaml`
2. `yarn openapi:build` - generates API SDK and models under `src/apis/`

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
