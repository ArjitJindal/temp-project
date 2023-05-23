#!/bin/sh

# Configuration File Path
CONFIG_INFRA=config/app-config.json

ACCOUNT=$(cat $CONFIG_INFRA | jq -r '.Project.Account') #ex> 123456789123
REGION=$(cat $CONFIG_INFRA | jq -r '.Project.Region') #ex> eu-central-1
PROFILE_NAME=$(cat $CONFIG_INFRA | jq -r '.Project.Profile') #ex> cdk-demo
PROJECT_NAME=$(cat $CONFIG_INFRA | jq -r '.Project.Name') #ex> TransactionRisk
PROJECT_STAGE=$(cat $CONFIG_INFRA | jq -r '.Project.Stage') #ex> Demo
PROJECT_PREFIX=$PROJECT_NAME$PROJECT_STAGE #ex> TransactionRiskDemo

aws sns publish --topic-arn arn:aws:sns:"$REGION":"$ACCOUNT":"$PROJECT_PREFIX"-TestTrigger-Topic --profile $PROFILE_NAME --message file://script/input_data.json