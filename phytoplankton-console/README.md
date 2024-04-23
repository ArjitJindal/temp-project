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

`yarn openapi:build` - generates API SDK and models under `src/apis/` using the schema from tarpon

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
> echo '127.0.0.1   flagright.local' | sudo tee -a '/etc/hosts'
> nvm use
> yarn
> yarn dev
```

Console should be available under https://flagright.local:8001/ (ignore warning about invalid certificate)

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

To deploy your PR to a QA environment, add a comment on your PR like:

```bash
# To deploy against main Tarpon
/deploy

# To deploy against Tarpon from a branch
/deploy optional-name-of-branch-in-tarpon
```

You can also deploy from local code with the following:

```
# To deploy against main Tarpon
yarn run deploy:qa

# To deploy against Tarpon from a branch
TARPON_BRANCH=optional-name-of-branch-in-tarpon yarn run deploy:qa
```

## Integration Tests

In order for integration tests to work, you need to have a cypress env file: `cypress.env.json` with the username and password of the integration test account. You can find this in 1Password shared workspace under `Cypress Test User`.

### Visual Testing

For running integs locally, install Cypress and run `npm run cypress:open`. This will open the Cypress window, choose your browser engine and manually run the test.

### Cypress Tests (E2E tests)

#### Run cypress tests interactively

Run against local Console

```bash
npm run cypress:open
```

Run against Dev Console

```bash
ENV=dev npm run cypress:open
```

#### Run all cypress tests

Run against local Console

```bash
npm run cypress:run
```

Run against Dev Console

```bash
ENV=dev npm run cypress:run
```
