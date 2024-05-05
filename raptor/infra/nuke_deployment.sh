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

echo ==--------DestroyStacksStepByStep---------==
cdk destroy *-ModelServingStack --force --profile $PROFILE_NAME
cdk destroy *-ModelArchivingStack --force --profile $PROFILE_NAME
echo .
