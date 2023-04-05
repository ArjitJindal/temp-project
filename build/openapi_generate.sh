#!/usr/bin/env bash

set -e

rm -rf src/apis

yarn exec openapi-generator-cli generate -- -i config/openapi.yaml -g typescript -o src/apis --additional-properties=modelPropertyNaming=original --template-dir build/openapi_generate_templates/overrides

mkdir -p /tmp/flagright/phytoplankton || true
yarn exec openapi-generator-cli generate -- -i config/openapi.yaml -g typescript -o /tmp/flagright/phytoplankton --additional-properties=modelPropertyNaming=original --template-dir build/openapi_generate_templates/custom
mv /tmp/flagright/phytoplankton/models src/apis/models-custom

FILES=("src/apis/models/Business.ts" "src/apis/models/InternalBusinessUser.ts" "src/apis/models/InternalUser.ts" "src/apis/models/InternalBusinessUser.ts" "src/apis/models/BusinessOptional.ts")
SED_REPLACE="/import { CardDetails | GenericBankAccountDetails | IBANDetails | ACHDetails | SWIFTDetails | MpesaDetails | UPIDetails | WalletDetails | CheckDetails } from '.\/CardDetails | GenericBankAccountDetails | IBANDetails | ACHDetails | SWIFTDetails | MpesaDetails | UPIDetails | WalletDetails | CheckDetails';/d"
# Fix wrong TS types
if [ "$(uname)" = "Darwin" ]; then
    sed -i '' "s/\* as URLParse/URLParse/g" src/apis/http/http.ts
    sed -i '' "s/private url: URLParse/private url: URLParse<Record<string, string | undefined>>/g" src/apis/http/http.ts

    for FILE in ${FILES[@]};
    do
      sed -i '' "${SED_REPLACE}" $FILE
    done
elif [ "$(expr substr $(uname -s) 1 5)" = "Linux" ]; then
    sed -i "s/\* as URLParse/URLParse/g" src/apis/http/http.ts
    sed -i "s/private url: URLParse/private url: URLParse<Record<string, string | undefined>>/g" src/apis/http/http.ts

    for FILE in ${FILES[@]};
    do
      sed -i "${SED_REPLACE}" $FILE
    done
fi

prettier --write src/apis
