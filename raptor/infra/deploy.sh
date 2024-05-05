#!/bin/sh

# Configuration File Path
CONFIG_INFRA=config/app-config.json

PROFILE_NAME=$(cat $CONFIG_INFRA | jq -r '.Project.Profile') #ex> cdk-demo

echo ==--------ConfigInfo---------==
echo $CONFIG_INFRA
echo $PROFILE_NAME

echo ==--------ListStacks---------==
cdk list
echo .

echo ==--------DeployStacksStepByStep---------==
cdk deploy *-ModelServingStack --require-approval never --profile $PROFILE_NAME
cdk deploy *-ModelArchivingStack --require-approval never --profile $PROFILE_NAME
echo .
	