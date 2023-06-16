# TODO: Rewrite this script in https://www.notion.so/flagright/16d55dfca8e2436c9c7786ab7c62e04e?v=405634e11b6540d28e7ba65502dc5ccb&p=5e147e38bb7e4bc2a9024eeda388ba5f&pm=c
# Example usage: bash src/scripts/onboard-tarpon-api.sh --tenantName testtest --tenantWebsite https://testtest.com/ --profile AWSAdministratorAccess-293986822825 --env sandbox --region eu-central-1

set -e

while [ $# -gt 0 ]; do
   if [[ $1 == *"--"* ]]; then
        v="${1/--/}"
        declare $v="$2"
   fi
  shift
done

if [ -z "$tenantName" ] || [ -z "$tenantWebsite" ] || [ -z "$env" ]
then
    echo "Please provide tenantName, tenantWebsite, env"
    exit 1
fi

if [ "$env" == "dev" ]; then
    apiPrefix="dev."
    apiId=qlqb0wdz5m
    managementApiId=ngxl4k8zue
    profile="AWSAdministratorAccess-911899431626"
    region="eu-central-1"
    tsScriptRegion="dev"
elif [ "$env" == "sandbox" ]; then
    apiPrefix="sandbox."
    apiId=i5deptp279
    managementApiId=0s4uddw2b8
    profile="AWSAdministratorAccess-293986822825"
    region="eu-central-1"
    tsScriptRegion="sandbox"
elif [ "$env" == "prod-asia-1" ]; then
    apiPrefix="asia-1."
    apiId=afxr1lytv8
    managementApiId=ipnq6xnl8d
    profile="AWSAdministratorAccess-870721492449"
    region="ap-southeast-1"
    tsScriptRegion="prod:asia-1"
elif [ "$env" == "prod-asia-2" ]; then
    apiPrefix="asia-2."
    apiId=hlpwcaxvcj
    managementApiId=gc0h405ip9
    profile="AWSAdministratorAccess-870721492449"
    region="ap-south-1"
    tsScriptRegion="prod:asia-2"
elif [ "$env" == "prod-eu-1" ]; then
    apiPrefix="eu-1."
    apiId=chw09486vg
    managementApiId=akxtug4fh2
    profile="AWSAdministratorAccess-870721492449"
    region="eu-central-1"
    tsScriptRegion="prod:eu-1"
elif [ "$env" == "prod-eu-2" ]; then
    apiPrefix="eu-2."
    apiId=axoppr09ui
    managementApiId=yz827gk7l0
    profile="AWSAdministratorAccess-870721492449"
    region="eu-west-2"
    tsScriptRegion="prod:eu-2"
elif [ "$env" == "prod-us-1" ]; then
    apiPrefix="us-1."
    apiId=eb7lsu6eqb
    managementApiId=w79lu22nyb
    profile="AWSAdministratorAccess-870721492449"
    region="us-west-2"
    tsScriptRegion="prod:us-1"
else
    echo "Unknown env"
    exit 1
fi

export AWS_REGION=$region

echo "❗❗ Please copy the credentials of the corresponding account from https://d-9a6713bec9.awsapps.com/start#/ and paste to the terminal as environment variables first"

existingTenantId=$(aws apigateway get-usage-plans \
    --profile $profile --region $region \
    | jq -c ".items| .[] | select(.name | contains(\":$tenantName:\")) | .name | match(\".*:$tenantName:(.*)\").captures[0].string")
if [ -n "$existingTenantId" ]; then
    echo "$tenantName ($existingTenantId) is already onboarded. Do nothing."
    exit 0
fi

if [ -n "$tenantId" ]; then
    tenantId="$tenantId"
else
    tenantId=`node -e "console.log(require('nanoid').customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10)())"`
fi
usagePlanName="tarpon:$tenantId:$tenantName"

if [ "$env" == "dev" ] || [ "$env" == "sandbox" ]; then
    usagePlanId=$(aws apigateway create-usage-plan \
    --name $usagePlanName \
    --description $tenantWebsite \
    --api-stages "[{\"apiId\": \"$apiId\", \"stage\": \"prod\"}, {\"apiId\": \"$managementApiId\", \"stage\": \"prod\"}]" \
    --throttle burstLimit=6,rateLimit=3 \
    --quota limit=1000,offset=0,period=MONTH \
    --profile $profile \
    --region $region \
    | jq -r '.id')
else
    usagePlanId=$(aws apigateway create-usage-plan \
    --name $usagePlanName \
    --description $tenantWebsite \
    --api-stages "[{\"apiId\": \"$apiId\", \"stage\": \"prod\"}, {\"apiId\": \"$managementApiId\", \"stage\": \"prod\"}]" \
    --throttle burstLimit=200,rateLimit=100 \
    --profile $profile \
    --region $region \
    | jq -r '.id')
fi


echo "Tenant ID: $tenantId";
echo "Usage plan name: $usagePlanName";
echo "Usage plan ID: $usagePlanId";

if [ "$env" == "dev" ]; then
    apiKey=$(awscurl --service execute-api \
        -X POST \
        --region "$region" \
        --profile $profile \
        "https://api.flagright.dev/console/apikey?tenantId=$tenantId&usagePlanId=$usagePlanId");
else
    apiKey=$(awscurl --service execute-api \
        -X POST \
        --region "$region" \
        --profile $profile \
        "https://"$apiPrefix"api.flagright.com/console/apikey?tenantId=$tenantId&usagePlanId=$usagePlanId");
fi

echo "Tarpon API Key: $apiKey";

