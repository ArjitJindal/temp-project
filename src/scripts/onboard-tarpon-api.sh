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

if [ "$env" == "sandbox" ]; then
    apiPrefix="sandbox."
    apiId=i5deptp279
    profile="AWSAdministratorAccess-293986822825"
    region="eu-central-1"
elif [ "$env" == "dev" ]; then
    apiPrefix="dev."
    apiId=lujzovzbk3
    profile="AWSAdministratorAccess-911899431626"
    region="eu-central-1"
elif [ "$env" == "prod-asia-1" ]; then
    apiPrefix="asia-1."
    apiId=afxr1lytv8
    profile="AWSAdministratorAccess-870721492449"
    region="ap-southeast-1"
elif [ "$env" == "prod-asia-2" ]; then
    apiPrefix="asia-2."
    apiId=hlpwcaxvcj
    profile="AWSAdministratorAccess-870721492449"
    region="ap-south-1"
elif [ "$env" == "prod-eu-1" ]; then
    apiPrefix="eu-1."
    apiId=chw09486vg
    profile="AWSAdministratorAccess-870721492449"
    region="eu-central-1"
else
    echo "Unknown env"
    exit 1
fi

echo "❗❗ Please copy the credentials of the corresponding account from https://d-9a6713bec9.awsapps.com/start#/ and paste to ~/.aws/credentials (profile: $profile)"
echo "TODO: https://flagright.atlassian.net/jira/software/projects/FDT/boards/1?selectedIssue=FDT-216"
npm run aws-sso-login --profile=$profile

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
    --api-stages apiId=$apiId,stage=prod \
    --throttle burstLimit=6,rateLimit=3 \
    --quota limit=1000,offset=0,period=MONTH \
    --profile $profile \
    --region $region \
    | jq -r '.id')
else
    usagePlanId=$(aws apigateway create-usage-plan \
    --name $usagePlanName \
    --description $tenantWebsite \
    --api-stages apiId=$apiId,stage=prod \
    --throttle burstLimit=200,rateLimit=100 \
    --profile $profile \
    --region $region \
    | jq -r '.id')
fi


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
    -d '{"id":"R-1","name":"First payment of a Customer","description":"First transaction of a user","defaultParameters":{},"defaultAction":"FLAG","ruleImplementationName":"first-payment","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-5
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-5","name":"Dormant accounts","description":"If a user has made a transaction after being inactive for time t, suspend user & transactions","defaultParameters":{"dormancyPeriodDays":360},"defaultAction":"FLAG","ruleImplementationName":"first-activity-after-time-period","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-101
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-101","name":"Isolated crypto users","description":"A user makes >= x crypto transactions without any fiat transactions","defaultParameters":{"targetTransactionsThreshold":5,"targetTransactionType":"CRYPTO_DEPOSIT","otherTransactionTypes":["FIAT_DEPOSIT"],"timeWindowInDays":30},"defaultAction":"FLAG","ruleImplementationName":"consecutive-transactions-same-type","labels":["AML","Fraud"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-6
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-6","name":"High risk currency","description":"Transaction includes a currency that is designated as high risk. Mostly relevant for when you are moving funds between different currencies. This rule uses a customizable list.","defaultParameters":{"highRiskCurrencies":["AFN","BYN","KPW","LYD","RUB","SYP"]},"defaultAction":"FLAG","ruleImplementationName":"high-risk-currency","labels":["AML","Sanctions"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-52
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-52","name":"Same IP address for too many users","description":"Same IP address for >= x unique user IDs","defaultParameters":{"uniqueUsersCountThreshold":2,"timeWindowInDays":30},"defaultAction":"FLAG","ruleImplementationName":"ip-address-multiple-users","labels":["Fraud"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-7
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-7","name":"Too many inbound transactions under reporting limit","description":">= x number of low value incoming transactions just below (minus amount of z) a specific threshold (y) to a user (your user is receiving the funds). Very useful and common for structured money laundering attempts. This is a recommended rule.","defaultParameters":{"lowTransactionValues":{"EUR":{"max":1000,"min":990}},"lowTransactionCount":3},"defaultAction":"FLAG","ruleImplementationName":"low-value-incoming-transactions","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-8
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-8","name":"Too many outbound transactions under reporting limit","description":">= x number of low value outgoing transactions just below (minus amount of z) a specific threshold (y) from a user (your user is sending the funds). Very useful and common for structured money laundering attempts. This is a recommended rule.","defaultParameters":{"lowTransactionValues":{"EUR":{"max":1000,"min":990}},"lowTransactionCount":3},"defaultAction":"FLAG","ruleImplementationName":"low-value-outgoing-transactions","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-9
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-9","name":"Too many customers for a single counterparty","description":"More than x users transacting with a single counterparty over a set period of time t (E.g. Nigerian prince scam outbound)","defaultParameters":{"sendersCount":4,"timePeriodDays":30},"defaultAction":"FLAG","ruleImplementationName":"multiple-user-senders-within-time-period","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-10
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-10","name":"Too many counterparties for a single customer","description":"More than x counterparties transacting with a single user over a set period of time t (E.g. Nigerian prince scam inbound)","defaultParameters":{"sendersCount":4,"timePeriodDays":30},"defaultAction":"FLAG","ruleImplementationName":"multiple-counterparty-senders-within-time-period","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-112
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-112","name":"High volume transactions of specific age interval customers","description":"Transaction amount >= X transactions belong to customers whose age is between y and z ","defaultParameters":{"transactionAmountThreshold":{"TRY":10000},"ageRange":{"minAge":18,"maxAge":21}},"defaultAction":"FLAG","ruleImplementationName":"transaction-amount","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-3
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-3","name":"Unexpected origin or destination country","description":"Transaction to or from a country that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between countries.","defaultParameters":{"initialTransactions":10},"defaultAction":"FLAG","ruleImplementationName":"transaction-new-country","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-4
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-4","name":"Unexpected origin or destination currency","description":"Transaction to or from a currency that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between different currencies.","defaultParameters":{"initialTransactions":10},"defaultAction":"FLAG","ruleImplementationName":"transaction-new-currency","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-103
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-103","name":"Potential trading bot","description":"A user account places >= x buy/sell/send/receive orders within time interval t seconds","defaultParameters":{"transactionsPerSecond":1, "transactionsLimit":1, "timeWindow": {"units": 50 "granularity": "minutes"}, "timeWindowInSeconds":1},"defaultAction":"FLAG","ruleImplementationName":"transactions-velocity","labels":["Fraud"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-111
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-111","name":"Two user IDs placing match buy/sell orders","description":"Flag transactions and user IDs when there are > x match orders in time t hours","defaultParameters":{"userPairsThreshold":1,"timeWindowInSeconds":3600},"defaultAction":"FLAG","ruleImplementationName":"user-transaction-pairs","labels":[],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-113
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-113","name":"User city changes too many times based on IP address","description":"User''s IP address show > x different cities within t days","defaultParameters":{"uniqueCitiesCountThreshold":1,"timeWindowInDays":1},"defaultAction":"FLAG","ruleImplementationName":"sender-location-changes-frequency","labels":["AML", "Fraud"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-24
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-24","name":"Reference field keyword","description":"Payment reference field includes a keyword in blacklist","defaultParameters":{"keywords": []},"defaultAction":"BLOCK","ruleImplementationName":"transaction-reference-keyword","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-69
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-69","name":"Customer outbound money flow is above expected monthly volume x","description":"Customer is spending much more money than expected","defaultParameters":{"transactionVolumeThresholds":{"MONTHLY":{"PHP":50000000}},"checkSender":"sending","checkReceiver":"none"},"defaultAction":"FLAG","ruleImplementationName":"transactions-volume-quantiles","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-75
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-75","name":"Currency transaction report needed","description":"If a transaction amount is more than x - a \"CTR\" is required by law. x depends on jurisdiction. EU is 10,000 euro; US is 10,000 USD","defaultParameters":{"transactionAmountThreshold":{"PHP":50000}},"defaultAction":"FLAG","ruleImplementationName":"transaction-amount","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-1
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-2","name":"Transaction amount too high","description":"Transaction amount is >= x in USD or equivalent","defaultParameters":{"transactionAmountThreshold":{"PHP":5000000}},"defaultAction":"FLAG","ruleImplementationName":"transaction-amount","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-99
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-99","name":"Transaction value exceeds customer declared limit x","description":"For a given user, user-declared transaction amount is <= x. Customers define an expected transaction amount when they are onboarding - this will compare that variable on their profile","defaultParameters":{},"defaultAction":"FLAG","ruleImplementationName":"transaction-amount-user-limit","labels":["AML", "Fraud"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-95
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-95","name":"High velocity receiver in hours","description":"Receiver is receiving >= x transactions in total within time t hours","defaultParameters":{"transactionsPerSecond":0.0694,"timeWindowInSeconds":7200,"checkSender":"none","checkReceiver":"receiving"},"defaultAction":"FLAG","ruleImplementationName":"transactions-velocity","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId

# R-109
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-109","name":"High volume receiver in hours","description":"Receiver is receiving >= USD x or equivalent amount in total within time t hours","defaultParameters":{"transactionVolumeThreshold":{"PHP":500000},"timeWindowInSeconds":3600,"checkSender":"none","checkReceiver":"receiving"},"defaultAction":"FLAG","ruleImplementationName":"transactions-volume","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId  

# R-110
awscurl --service execute-api \
    -X POST \
    --region "$region" \
    --profile "$profile" \
    -d '{"id":"R-110","name":"High volume receiver in days","description":"Receiver is receiving >= USD x or equivalent amount in total within time t days","defaultParameters":{"transactionVolumeThreshold":{"PHP":5000000},"timeWindowInSeconds":172800,"checkSender":"none","checkReceiver":"receiving"},"defaultAction":"FLAG","ruleImplementationName":"transactions-volume","labels":["AML"],"type":"TRANSACTION"}' \
    https://"$apiPrefix"api.flagright.com/console/iam/rules?tenantId=$tenantId  




echo "Rules and rule instances created."
