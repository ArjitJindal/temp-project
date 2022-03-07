#!/bin/bash

DEPLOYMENT_PROFILE="AWSAdministratorAccess-911899431626"
DEPLOYMENT_ACCOUNT_ID=911899431626

DEV_PROFILE="AWSAdministratorAccess-911899431626"
DEV_ACCOUNT_ID=911899431626

SANDBOX_PROFILE="AWSAdministratorAccess-293986822825"
SANDBOX_ACCOUNT_ID=293986822825

PROD_PROFILE="AWSAdministratorAccess-870721492449"
PROD_ACCOUNT_ID=870721492449


# Deploy roles without policies so the ARNs exist when the CDK Stack is deployed in parallel
printf "\nDeploying roles to Dev, Sandbox, Prod\n"
aws cloudformation deploy --template-file templates/CodePipelineCrossAccountRole.yml \
    --stack-name CodePipelineCrossAccountRole \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile ${DEV_PROFILE} \
    --parameter-overrides DeploymentAccountID=${DEPLOYMENT_ACCOUNT_ID} Stage=Dev &

aws cloudformation deploy --template-file templates/CloudFormationDeploymentRole.yml \
    --stack-name CloudFormationDeploymentRole \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile ${DEV_PROFILE} \
    --parameter-overrides DeploymentAccountID=${DEPLOYMENT_ACCOUNT_ID} Stage=Dev &

aws cloudformation deploy --template-file templates/CodePipelineCrossAccountRole.yml \
    --stack-name CodePipelineCrossAccountRole \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile ${SANDBOX_PROFILE} \
    --parameter-overrides DeploymentAccountID=${DEPLOYMENT_ACCOUNT_ID} Stage=Sandbox &
    
aws cloudformation deploy --template-file templates/CloudFormationDeploymentRole.yml \
    --stack-name CloudFormationDeploymentRole \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile ${SANDBOX_PROFILE} \
    --parameter-overrides DeploymentAccountID=${DEPLOYMENT_ACCOUNT_ID} Stage=Sandbox 

aws cloudformation deploy --template-file templates/CodePipelineCrossAccountRole.yml \
    --stack-name CodePipelineCrossAccountRole \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile ${PROD_PROFILE} \
    --parameter-overrides DeploymentAccountID=${DEPLOYMENT_ACCOUNT_ID} Stage=Prod &
    
aws cloudformation deploy --template-file templates/CloudFormationDeploymentRole.yml \
    --stack-name CloudFormationDeploymentRole \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile ${PROD_PROFILE} \
    --parameter-overrides DeploymentAccountID=${DEPLOYMENT_ACCOUNT_ID} Stage=Prod 


# Deploy Pipeline CDK stack, write output to a file to gather key arn
printf "\nDeploying Tarpon Pipeline Stack\n"

CDK_OUTPUT_FILE='.cdk_output'
rm -rf ${CDK_OUTPUT_FILE} .cfn_outputs
npx cdk deploy tarpon-pipeline \
  --profile ${DEPLOYMENT_PROFILE} \
  --require-approval never \
  2>&1 | tee -a ${CDK_OUTPUT_FILE}
sed -n -e '/Outputs:/,/^$/ p' ${CDK_OUTPUT_FILE} > .cfn_outputs
KEY_ARN=$(awk -F " " '/KeyArn/ { print $3 }' .cfn_outputs)

# Check that KEY_ARN is set after the CDK deployment
if [[ -z "${KEY_ARN}" ]]; then
  printf "\nSomething went wrong - we didn't get a Key ARN as an output from the CDK Pipeline deployment"
  exit
fi

# Update the CloudFormation roles with the Key ARNy in parallel
printf "\nUpdating roles with policies in Dev, Sandbox, Prod\n"
aws cloudformation deploy --template-file templates/CodePipelineCrossAccountRole.yml \
    --stack-name CodePipelineCrossAccountRole \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile ${DEV_PROFILE} \
    --parameter-overrides DeploymentAccountID=${DEPLOYMENT_ACCOUNT_ID} Stage=Dev KeyArn=${KEY_ARN} &

aws cloudformation deploy --template-file templates/CloudFormationDeploymentRole.yml \
    --stack-name CloudFormationDeploymentRole \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile ${DEV_PROFILE} \
    --parameter-overrides DeploymentAccountID=${DEPLOYMENT_ACCOUNT_ID} Stage=Dev KeyArn=${KEY_ARN} &

aws cloudformation deploy --template-file templates/CloudFormationDeploymentRole.yml \
    --stack-name CloudFormationDeploymentRole \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile ${SANDBOX_PROFILE} \
    --parameter-overrides DeploymentAccountID=${DEPLOYMENT_ACCOUNT_ID} Stage=Sandbox KeyArn=${KEY_ARN} &

aws cloudformation deploy --template-file templates/CodePipelineCrossAccountRole.yml \
    --stack-name CodePipelineCrossAccountRole \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile ${SANDBOX_PROFILE} \
    --parameter-overrides DeploymentAccountID=${DEPLOYMENT_ACCOUNT_ID} Stage=Sandbox KeyArn=${KEY_ARN} 

aws cloudformation deploy --template-file templates/CloudFormationDeploymentRole.yml \
    --stack-name CloudFormationDeploymentRole \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile ${PROD_PROFILE} \
    --parameter-overrides DeploymentAccountID=${DEPLOYMENT_ACCOUNT_ID} Stage=Prod KeyArn=${KEY_ARN} &

aws cloudformation deploy --template-file templates/CodePipelineCrossAccountRole.yml \
    --stack-name CodePipelineCrossAccountRole \
    --capabilities CAPABILITY_NAMED_IAM \
    --profile ${PROD_PROFILE} \
    --parameter-overrides DeploymentAccountID=${DEPLOYMENT_ACCOUNT_ID} Stage=Prod KeyArn=${KEY_ARN} 

# Clean up temporary files
rm ${CDK_OUTPUT_FILE} .cfn_outputs
