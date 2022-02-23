set -e

echo "Please manually export and replace config/openapi.yaml"
if [[ $(uname) == 'Darwin' ]]; then
   open https://docs.flagright.com/docs/flagright-console-api/YXBpOjQxODEwMzAy-tarpon-console-api
else
   xdg-open https://docs.flagright.com/docs/flagright-console-api/YXBpOjQxODEwMzAy-tarpon-console-api
fi
