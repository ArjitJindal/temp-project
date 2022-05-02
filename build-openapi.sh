set -e

rm -rf src/apis

openapi-generator-cli generate -i config/openapi.yaml -g typescript -o src/apis --additional-properties=modelPropertyNaming=original

# Fix wrong TS types
if [ "$(uname)" = "Darwin" ]; then
    sed -i '' "s/\* as URLParse/URLParse/g" src/apis/http/http.ts
    sed -i '' "s/private url: URLParse/private url: URLParse<Record<string, string | undefined>>/g" src/apis/http/http.ts
elif [ "$(expr substr $(uname -s) 1 5)" = "Linux" ]; then
    sed -i "s/\* as URLParse/URLParse/g" src/apis/http/http.ts
    sed -i "s/private url: URLParse/private url: URLParse<Record<string, string | undefined>>/g" src/apis/http/http.ts
fi

prettier --write src/apis
