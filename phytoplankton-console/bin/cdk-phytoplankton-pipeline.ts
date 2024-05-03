#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { isQaEnv } from '@flagright/lib/qa';
import { Tags } from 'aws-cdk-lib';
import { CdkPhytoplanktonStack } from '../lib/cdk-phytoplankton-stack';
import { CONFIG_MAP, Stage } from '../lib/configs/config';

const app = new cdk.App();

const stage = process.env.ENV as Stage;
const suffix = isQaEnv() ? `-${process.env.QA_SUBDOMAIN}` : '';

const stack = new CdkPhytoplanktonStack(
  app,
  `${stage?.replace(':user', '')}-phytoplankton${suffix}`,
  CONFIG_MAP[stage],
);
Tags.of(stack).add('deployment', 'phytoplankton');
