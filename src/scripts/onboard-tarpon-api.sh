while [ $# -gt 0 ]; do
   if [[ $1 == *"--"* ]]; then
        v="${1/--/}"
        declare $v="$2"
   fi
  shift
done

if [ -z "$tenantName" ] || [ -z "$tenantWebsite" ] || [ -z "$profile" ] || [ -z "$env" ]
then
    echo "Please provide tenantName, tenantWebsite, profile, env"
    exit 1
fi

if [ "$env" == "sandbox" ]; then
    apiPrefix="sandbox."
    apiId=itkfqhhxn5
elif [ "$env" == "dev" ]; then
    apiPrefix="dev."
    apiId=kdlntrvdyi
elif [ "$env" == "prod" ]; then
    apiPrefix=""
    apiId=igt4gjot0j
fi

tenantId=`node -e "console.log(require('nanoid').customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10)())"`
usagePlanName="tarpon:$tenantName:$tenantId"
usagePlanId=$(aws apigateway create-usage-plan \
  --name $usagePlanName \
  --description $tenantWebsite \
  --api-stages apiId=$apiId,stage=prod \
  --throttle burstLimit=6,rateLimit=3 \
  --quota limit=1000,offset=0,period=MONTH \
  --profile $profile \
| jq -r '.id')


echo "Tenant ID: $tenantId";
echo "Usage plan name: $usagePlanName";

apiKey=$(awscurl --service execute-api \
    -X POST \
    --region us-east-2 \
    --profile $profile \
    "https://"$apiPrefix"api.flagright.com/console/apikey?tenantId=$tenantId&usagePlanId=$usagePlanId");

echo "Tarpon API Key: $apiKey"

awscurl --service execute-api \
    -X POST \
    --region us-east-2 \
    --profile $profile \
    -d '{"ruleId": "R-1","status": "ACTIVE", "parameters":{"action":"FLAG"}}' \
    https://"$apiPrefix"api.flagright.com/console/rule_instances?tenantId=$tenantId >/dev/null

awscurl --service execute-api \
    -X POST \
    --region us-east-2 \
    --profile $profile \
    -d '{"ruleId": "R-2","status": "ACTIVE", "parameters":{"action":"FLAG","initialTransactions":10}}' \
    https://"$apiPrefix"api.flagright.com/console/rule_instances?tenantId=$tenantId >/dev/null

awscurl --service execute-api \
    -X POST \
    --region us-east-2 \
    --profile $profile \
    -d '{"ruleId": "R-3","status": "ACTIVE", "parameters":{"action":"FLAG","initialTransactions":10}}' \
    https://"$apiPrefix"api.flagright.com/console/rule_instances?tenantId=$tenantId >/dev/null

awscurl --service execute-api \
    -X POST \
    --region us-east-2 \
    --profile $profile \
    -d '{"ruleId": "R-4","status": "ACTIVE", "parameters":{"action":"FLAG","dormancyPeriodDays":180}}' \
    https://"$apiPrefix"api.flagright.com/console/rule_instances?tenantId=$tenantId >/dev/null

awscurl --service execute-api \
    -X POST \
    --region us-east-2 \
    --profile $profile \
    -d '{"ruleId": "R-5","status": "ACTIVE", "parameters":{"action":"FLAG","highRiskCurrencies":["AFN"]}}' \
    https://"$apiPrefix"api.flagright.com/console/rule_instances?tenantId=$tenantId >/dev/null

awscurl --service execute-api \
    -X POST \
    --region us-east-2 \
    --profile $profile \
    -d '{"ruleId": "R-6","status": "ACTIVE", "parameters":{"action":"FLAG","lowTransactionValues":{"EUR":1000},"lowTransactionCount":3}}' \
    https://"$apiPrefix"api.flagright.com/console/rule_instances?tenantId=$tenantId >/dev/null

awscurl --service execute-api \
    -X POST \
    --region us-east-2 \
    --profile $profile \
    -d '{"ruleId": "R-7","status": "ACTIVE", "parameters":{"action":"FLAG","lowTransactionValues":{"EUR":1000},"lowTransactionCount":3}}' \
    https://"$apiPrefix"api.flagright.com/console/rule_instances?tenantId=$tenantId >/dev/null

awscurl --service execute-api \
    -X POST \
    --region us-east-2 \
    --profile $profile \
    -d '{"ruleId": "R-8","status": "ACTIVE", "parameters":{"action":"FLAG","sendersCount":4,"timePeriodDays":30}}' \
    https://"$apiPrefix"api.flagright.com/console/rule_instances?tenantId=$tenantId >/dev/null

awscurl --service execute-api \
    -X POST \
    --region us-east-2 \
    --profile $profile \
    -d '{"ruleId": "R-9","status": "ACTIVE", "parameters":{"action":"FLAG","sendersCount":4,"timePeriodDays":30}}' \
    https://"$apiPrefix"api.flagright.com/console/rule_instances?tenantId=$tenantId >/dev/null

echo "Rule instances with default parameters are created."