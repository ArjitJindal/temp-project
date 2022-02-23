# Download the openapi yaml files from
# - https://docs.flagright.com/docs/flagright-api/YXBpOjMyNjcyOTM0-flagright-api
# - https://docs.flagright.com/docs/flagright-console-api/YXBpOjQxODEwMzAy-tarpon-console-api
# to
# - lib/openapi/openapi-public-original.ytml
# - lib/openapi/openapi-internal-original.ytml

set -e

curl https://stoplight.io/api/v1/projects/flagright/flagright-api/nodes/reference/Flagright-API.yaml --output lib/openapi/openapi-public-original.yaml
echo "Public Tarpon API: Fetched"

echo "Internal Console API: Please manually export and replace lib/openapi/openapi-internal-original.yaml"
if [[ $(uname) == 'Darwin' ]]; then
   open https://docs.flagright.com/docs/flagright-console-api/YXBpOjQxODEwMzAy-tarpon-console-api
else
   xdg-open https://docs.flagright.com/docs/flagright-console-api/YXBpOjQxODEwMzAy-tarpon-console-api
fi

node_modules/.bin/prettier --write lib/openapi/*