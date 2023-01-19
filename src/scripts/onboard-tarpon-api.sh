set -e

while [ $# -gt 0 ]; do
   if [[ $1 == *"--"* ]]; then
        v="${1/--/}"
        declare $v="$2"
   fi
  shift
done

if [ -z "$tenantName" ] || [ -z "$tenantWebsite" ] || [ -z "$env" ] || [ -z "$createAuth0Org" ]
then
    echo "Please provide tenantName, tenantWebsite, env, createAuth0Org"
    exit 1
fi

if [ "$createAuth0Org" == "true" ]; then
    if [ -z "$auth0DisplayName" ]; then
        echo "Please provide auth0DisplayName"
        exit 1
    fi
fi

if [ "$env" == "dev" ]; then
    apiPrefix="dev."
    apiId=lujzovzbk3
    managementApiId=9lbziivbh1
    profile="AWSAdministratorAccess-911899431626"
    region="eu-central-1"
elif [ "$env" == "sandbox" ]; then
    apiPrefix="sandbox."
    apiId=i5deptp279
    managementApiId=0s4uddw2b8
    profile="AWSAdministratorAccess-293986822825"
    region="eu-central-1"
elif [ "$env" == "prod-asia-1" ]; then
    apiPrefix="asia-1."
    apiId=afxr1lytv8
    managementApiId=ipnq6xnl8d
    profile="AWSAdministratorAccess-870721492449"
    region="ap-southeast-1"
elif [ "$env" == "prod-asia-2" ]; then
    apiPrefix="asia-2."
    apiId=hlpwcaxvcj
    managementApiId=gc0h405ip9
    profile="AWSAdministratorAccess-870721492449"
    region="ap-south-1"
elif [ "$env" == "prod-eu-1" ]; then
    apiPrefix="eu-1."
    apiId=chw09486vg
    managementApiId=akxtug4fh2
    profile="AWSAdministratorAccess-870721492449"
    region="eu-central-1"
elif [ "$env" == "prod-eu-2" ]; then
    apiPrefix="eu-2."
    apiId=axoppr09ui
    managementApiId=yz827gk7l0
    profile="AWSAdministratorAccess-870721492449"
    region="eu-west-2"
elif [ "$env" == "prod-us-1" ]; then
    apiPrefix="us-1."
    apiId=eb7lsu6eqb
    managementApiId=w79lu22nyb
    profile="AWSAdministratorAccess-870721492449"
    region="us-west-2"
else
    echo "Unknown env"
    exit 1
fi

export AWS_REGION=$region

echo "❗❗ Please copy the credentials of the corresponding account from https://d-9a6713bec9.awsapps.com/start#/ and paste to the terminal as environment variables first

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
usagePlanName="tarpon:$tenantName:$tenantId"

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

apiKey=$(awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile $profile \
    "https://"$apiPrefix"api.flagright.com/console/apikey?tenantId=$tenantId&usagePlanId=$usagePlanId");

echo "Tarpon API Key: $apiKey";

if [ "$createAuth0Org" == "true" ]; then
    echo "Creating Auth0 organization"
    organization=$(ENV=$env ts-node src/scripts/auth0CreateOrganization.ts --tenantName=$tenantName --auth0OrganizationName=$auth0DisplayName --tenantId=$tenantId --apiPrefix=$apiPrefix)
    echo $organization
else
    echo "Skipping Auth0 organization creation"
fi

if [ "$createDemoTenant" == "true" ]; then
    echo "Creating demo tenant"
    apiKeyDemo=$(awscurl --service execute-api \
        -X POST \
        --region "$region" \
        --profile $profile \
        "https://"$apiPrefix"api.flagright.com/console/apikey?tenantId=${tenantId}&demoTenant=true&usagePlanId=$usagePlanId");
    echo "Tarpon Demo API Key: $apiKeyDemo"
else
    echo "Skipping creating demo tenant"
fi

