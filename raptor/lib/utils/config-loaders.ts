import fs = require('fs')

import { AppConfig, StackTypes } from './types'

export function loadConfig(configFilePath: string): AppConfig {
  return loadConfigFromFile(configFilePath)
}

function loadConfigFromFile(filePath: string): AppConfig {
  const config = JSON.parse(fs.readFileSync(filePath).toString())
  config['InfraConfigFile'] = filePath

  return addProjectPrefix(config)
}

function addProjectPrefix(config: AppConfig): AppConfig {
  const projectPrefix = `${config.Project.Name}${config.Project.Stage}`

  for (const key in config.Stack) {
    config.Stack[key as StackTypes].Name = `${projectPrefix}-${
      config.Stack[key as StackTypes].Name
    }`
  }

  return config
}
