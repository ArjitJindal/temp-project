#!/bin/bash
profile=$1
export AWS_ACCESS_KEY_ID=$(aws configure get aws_access_key_id --profile $profile)
export AWS_SECRET_ACCESS_KEY=$(aws configure get aws_secret_access_key --profile $profile)
export AWS_SESSION_TOKEN=$(aws configure get aws_session_token --profile $profile)

echo "Done"