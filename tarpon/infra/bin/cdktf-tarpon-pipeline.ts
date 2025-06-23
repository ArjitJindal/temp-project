#!/usr/bin/env node
import { App } from 'cdktf'
import { getTarponConfig } from '@flagright/lib/constants/config'
import { stageAndRegion } from '@flagright/lib/utils/env'
import { Tags } from 'aws-cdk-lib'
import { CdktfTarponStack } from '../cdktf-tarpon-stack'

const app = new App()

const [stage, region] = stageAndRegion()
const cfg = getTarponConfig(stage, region)
const stack = new CdktfTarponStack(app, `${cfg.stage}-tarpon`, cfg)
Tags.of(stack).add('Project', 'load-testing')
app.synth()
