#!/usr/bin/env ts-node
process.env.ENV = process.env.ENV || 'local'

import './dynamo'
import './mongo'
