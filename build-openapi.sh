set -e

# Public API
openapi-generator generate -i lib/openapi/openapi-public-original.yaml -g typescript-node -o /tmp/flagright/public_openapi_types --additional-properties=modelPropertyNaming=original
rm -rf src/@types/openapi-public/*
mv /tmp/flagright/public_openapi_types/model/* src/@types/openapi-public/
sed -i '' "s/import { RequestFile } from '.\\/models'//g" src/@types/openapi-public/*
rm -f src/@types/openapi-public/models.ts
ts-node lib/openapi/openapi-public-augmentor.ts

# Internal API
openapi-generator generate -i lib/openapi/openapi-internal-original.yaml -g typescript-node -o /tmp/flagright/internal_openapi_types --additional-properties=modelPropertyNaming=original
rm -rf src/@types/openapi-internal/*
mv /tmp/flagright/internal_openapi_types/model/* src/@types/openapi-internal/
sed -i '' "s/import { RequestFile } from '.\\/models'//g" src/@types/openapi-internal/*
rm -f src/@types/openapi-internal/models.ts
ts-node lib/openapi/openapi-internal-augmentor.ts

node_modules/.bin/prettier --write src/@types/openapi-public/ src/@types/openapi-internal/ lib/openapi/*