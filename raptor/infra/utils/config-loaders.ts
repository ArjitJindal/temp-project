const fs = require('fs')

export function loadConfig(configFilePath: string): any {
  return loadConfigFromFile(configFilePath)
}

function loadConfigFromFile(filePath: string): any {
  let config: any = JSON.parse(fs.readFileSync(filePath).toString())
  config['InfraConfigFile'] = filePath

  return addProjectPrefix(config)
}

function addProjectPrefix(config: any): any {
  const projectPrefix = `${config.Project.Name}${config.Project.Stage}`

  for (const key in config.Stack) {
    config.Stack[key].Name = `${projectPrefix}-${config.Stack[key].Name}`
  }

  return config
}
