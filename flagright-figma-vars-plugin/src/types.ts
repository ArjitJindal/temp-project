import { EventHandler } from '@create-figma-plugin/utilities'


export interface Settings {
  GITHUB_ACCESS_TOKEN?: string
}

export interface LoadSettingsHandler extends EventHandler {
  name: 'LOAD_SETTINGS'
}

export interface LoadSettingsResultHandler extends EventHandler {
  name: 'LOAD_SETTINGS_RESULT'
  handler: (settings: Settings) => void
}

export interface SaveSettingsHandler extends EventHandler {
  name: 'SAVE_SETTINGS';
  handler: (settings: Settings) => void
}

export interface ExportVariablesHandler extends EventHandler {
  name: 'EXPORT_VARIABLES'
  handler: (target: 'LESS' | 'TS') => void
}

export interface SyncVariablesHandler extends EventHandler {
  name: 'SYNC_VARIABLES'
}

export interface LogHandler extends EventHandler {
  name: 'LOG'
  handler: (type: 'INFO' | 'CLEAN', text?: string) => void
}

export interface CloseHandler extends EventHandler {
  name: 'CLOSE'
  handler: () => void
}
