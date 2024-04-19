#!/bin/bash

# Usage: sh deploy.sh [stage] [region] -- [additional arguments for cdktf deploy]

STAGE=$1
REGION=$2
shift 2  # This shifts the first two arguments out, leaving any additional ones.

([ -d ".gen" ] && echo "CDKTF already initialised" || cdktf get --quiet)

if [ -z "$STAGE" ] || [ -z "$REGION" ]; then
    echo "Stage and region are required."
    exit 1
fi

echo "Building python assets"
poetry build

echo "Deploying to stage: $STAGE, region: $REGION"

export STAGE=$STAGE
export REGION=$REGION
if [ "$QUIET_MODE" -eq 1 ]; then
  cdktf deploy --quiet
else
  cdktf deploy
fi
