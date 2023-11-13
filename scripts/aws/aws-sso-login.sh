#!/bin/bash
set -e
profile=$1

aws sso login --profile $profile
yawsso -p $profile

BACKGROUND="\x1b[37;41;1m"
NOCOLOR='\033[0m'
echo -e "\n\n\nRun this to load the AWS credentials ($profile) as env vars:\n"
echo -e "${BACKGROUND}source $(pwd)/scripts/aws/load-credentials.sh $profile${NOCOLOR}\n"