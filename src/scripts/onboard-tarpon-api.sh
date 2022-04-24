set -e

while [ $# -gt 0 ]; do
   if [[ $1 == *"--"* ]]; then
        v="${1/--/}"
        declare $v="$2"
   fi
  shift
done

if [ -z "$tenantName" ] || [ -z "$tenantWebsite" ] || [ -z "$profile" ] || [ -z "$env" ] || [ -z "$region" ]
then
    echo "Please provide tenantName, tenantWebsite, profile, env and region"
    exit 1
fi

if [ "$env" == "sandbox" ]; then
    apiPrefix="sandbox."
    apiId="s8v9vrpcad"
elif [ "$env" == "dev" ]; then
    apiPrefix="dev."
    apiId=lujzovzbk3
elif [ "$env" == "prod" ]; then
    apiPrefix=""
    apiId=""
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
  --region $region \
| jq -r '.id')


echo "Tenant ID: $tenantId";
echo "Usage plan name: $usagePlanName";

apiKey=$(awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile $profile \
    "https://"$apiPrefix"api.flagright.com/console/apikey?tenantId=$tenantId&usagePlanId=$usagePlanId");

echo "Tarpon API Key: $apiKey"

echo "Setting up rules..."

# R-1
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-1","name":"First payment of a Customer","description":"First transaction of a user","defaultParameters":{},"defaultAction":"FLAG","ruleImplementationName":"first-payment","labels":["AML"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-1","parameters":{},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-5
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-5","name":"Dormant accounts","description":"If a user has made a transaction after being inactive for time t, suspend user & transactions","defaultParameters":{"dormancyPeriodDays":360},"defaultAction":"FLAG","ruleImplementationName":"first-activity-after-time-period","labels":["AML"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-5","parameters":{"dormancyPeriodDays":360},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-101
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-101","name":"Isolated crypto users","description":"A user makes >= x crypto transactions without any fiat transactions","defaultParameters":{"targetTransactionsThreshold":5,"targetTransactionType":"CRYPTO_DEPOSIT","otherTransactionTypes":["FIAT_DEPOSIT"],"timeWindowInDays":30},"defaultAction":"FLAG","ruleImplementationName":"consecutive-transactions-same-type","labels":["AML","Fraud"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-101","parameters":{"targetTransactionsThreshold":5,"targetTransactionType":"CRYPTO_DEPOSIT","otherTransactionTypes":["FIAT_DEPOSIT"],"timeWindowInDays":30},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-6
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-6","name":"High risk currency","description":"Transaction includes a currency that is designated as high risk. Mostly relevant for when you are moving funds between different currencies. This rule uses a customizable list.","defaultParameters":{"highRiskCurrencies":["AFN","BYN","KPW","LYD","RUB","SYP"]},"defaultAction":"FLAG","ruleImplementationName":"high-risk-currency","labels":["AML","Sanctions"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-6","parameters":{"highRiskCurrencies":["AFN","BYN","KPW","LYD","RUB","SYP"]},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-52
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-52","name":"Same IP address for too many users","description":"Same IP address for >= x unique user IDs","defaultParameters":{"uniqueUsersCountThreshold":2,"timeWindowInDays":30},"defaultAction":"FLAG","ruleImplementationName":"ip-address-multiple-users","labels":["Fraud"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-52","parameters":{"uniqueUsersCountThreshold":2,"timeWindowInDays":30},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-7
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-7","name":"Too many inbound transactions under reporting limit","description":">= x number of low value incoming transactions just below (minus amount of z) a specific threshold (y) to a user (your user is receiving the funds). Very useful and common for structured money laundering attempts. This is a recommended rule.","defaultParameters":{"lowTransactionValues":{"EUR":{"max":1000,"min":990}},"lowTransactionCount":3},"defaultAction":"FLAG","ruleImplementationName":"low-value-incoming-transactions","labels":["AML"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-7","parameters":{"lowTransactionValues":{"EUR":{"max":1000,"min":990}},"lowTransactionCount":3},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-8
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-8","name":"Too many outbound transactions under reporting limit","description":">= x number of low value outgoing transactions just below (minus amount of z) a specific threshold (y) from a user (your user is sending the funds). Very useful and common for structured money laundering attempts. This is a recommended rule.","defaultParameters":{"lowTransactionValues":{"EUR":{"max":1000,"min":990}},"lowTransactionCount":3},"defaultAction":"FLAG","ruleImplementationName":"low-value-outgoing-transactions","labels":["AML"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-8","parameters":{"lowTransactionValues":{"EUR":{"max":1000,"min":990}},"lowTransactionCount":3},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-9
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-9","name":"Too many customers for a single counterparty","description":"More than x users transacting with a single counterparty over a set period of time t (E.g. Nigerian prince scam outbound)","defaultParameters":{"sendersCount":4,"timePeriodDays":30},"defaultAction":"FLAG","ruleImplementationName":"multiple-user-senders-within-time-period","labels":["AML"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-9","parameters":{"sendersCount":4,"timePeriodDays":30},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-10
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-10","name":"Too many counterparties for a single customer","description":"More than x counterparties transacting with a single user over a set period of time t (E.g. Nigerian prince scam inbound)","defaultParameters":{"sendersCount":4,"timePeriodDays":30},"defaultAction":"FLAG","ruleImplementationName":"multiple-counterparty-senders-within-time-period","labels":["AML"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-10","parameters":{"sendersCount":4,"timePeriodDays":30},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-112
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-112","name":"High volume transactions of specific age interval customers","description":"Transaction amount >= X transactions belong to customers whose age is between y and z ","defaultParameters":{"transactionAmountThreshold":{"TRY":10000},"ageRange":{"minAge":18,"maxAge":21}},"defaultAction":"FLAG","ruleImplementationName":"transaction-amount","labels":["AML"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-112","parameters":{"transactionAmountThreshold":{"TRY":10000},"ageRange":{"minAge":18,"maxAge":21}},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-3
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-3","name":"Unexpected origin or destination country","description":"Transaction to or from a country that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between countries.","defaultParameters":{"initialTransactions":10},"defaultAction":"FLAG","ruleImplementationName":"transaction-new-country","labels":["AML"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-3","parameters":{"initialTransactions":10},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-4
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-4","name":"Unexpected origin or destination currency","description":"Transaction to or from a currency that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between different currencies.","defaultParameters":{"initialTransactions":10},"defaultAction":"FLAG","ruleImplementationName":"transaction-new-currency","labels":["AML"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-4","parameters":{"initialTransactions":10},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-103
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-103","name":"Potential trading bot","description":"A user account places >= x buy/sell/send/receive orders within time interval t seconds","defaultParameters":{"transactionsPerSecond":1,"timeWindowInSeconds":1},"defaultAction":"FLAG","ruleImplementationName":"transactions-velocity","labels":["Fraud"]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-103","parameters":{"transactionsPerSecond":1,"timeWindowInSeconds":1},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

# R-111
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-111","name":"Two user IDs placing match buy/sell orders","description":"Flag transactions and user IDs when there are > x match orders in time t hours","defaultParameters":{"userPairsThreshold":1,"timeWindowInSeconds":3600},"defaultAction":"FLAG","ruleImplementationName":"user-transaction-pairs","labels":[]}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"ruleId":"R-111","parameters":{"userPairsThreshold":1,"timeWindowInSeconds":3600},"action":"FLAG"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rule_instances?tenantId=$tenantId

echo "Rules and rule instances created."