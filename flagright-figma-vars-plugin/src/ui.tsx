import {
  Button,
  Columns,
  Dropdown,
  render,
  Stack,
  Tabs,
  Text,
  Textbox,
  VerticalSpace,
} from '@create-figma-plugin/ui'
import { emit, on } from '@create-figma-plugin/utilities'
import { Fragment, h } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'

import '!./global.css'
import s from './styles.css'

import {
  ExportVariablesHandler,
  LoadSettingsHandler,
  LoadSettingsResultHandler,
  LogHandler,
  SaveSettingsHandler,
  Settings,
  SyncVariablesHandler,
} from './types'

const DEFAULT_SPACING = 'small'

function Plugin() {
  const [log, setLog] = useState('')

  useEffect(() => {
    on<LoadSettingsResultHandler>('LOAD_SETTINGS_RESULT', (settings) => {
      console.log('settings loaded', settings)
    })
    on<LogHandler>('LOG', (type, text) => {
      setLog((value) => {
        if (type === 'CLEAN') {
          return ''
        } else {
          return value + (text ?? '') + '\n'
        }
      })
    })
  }, [])

  const [tab, setTab] = useState<string>('Actions')

  return (
    <div className={s.root}>
      <Tabs
        onChange={(event) => {
          const newValue = event.currentTarget.value
          setTab(newValue)
        }}
        options={[
          {
            children: <Fragment></Fragment>,
            value: 'Actions',
          },
          {
            children: <Fragment></Fragment>,
            value: 'Settings',
          },
        ]}
        value={tab}
      />
      <textarea className={s.log} value={log} style={{ flex: 1 }} readOnly />
      <VerticalSpace space={DEFAULT_SPACING} />
      {tab === 'Actions' && <ActionsTab />}
      {tab === 'Settings' && <SettingsTab />}
    </div>
  )
}

function ActionsTab() {
  const [exportType, setExportType] = useState<'LESS' | 'TS'>('LESS')
  const handleSyncWithGithubClick = useCallback(() => {
    emit<SyncVariablesHandler>('SYNC_VARIABLES')
  }, [])
  const handleExportButtonClick = useCallback(() => {
    emit<ExportVariablesHandler>('EXPORT_VARIABLES', exportType)
  }, [])
  return (
    <Columns space={DEFAULT_SPACING}>
      <Button fullWidth onClick={handleSyncWithGithubClick}>
        Sync with github
      </Button>
      <Button fullWidth onClick={handleExportButtonClick}>
        Export
      </Button>
      <Dropdown
        onChange={(e) => {
          setExportType(e.currentTarget.value as 'LESS' | 'TS')
        }}
        options={[
          {
            value: 'LESS',
            text: 'LESS',
          },
          {
            value: 'TS',
            text: 'TypeScript',
          },
        ]}
        value={exportType}
      />
    </Columns>
  )
}

function SettingsTab() {
  const [settings, setSettings] = useState<Settings>({})

  useEffect(() => {
    emit<LoadSettingsHandler>('LOAD_SETTINGS')
    return on<LoadSettingsResultHandler>('LOAD_SETTINGS_RESULT', (settings) => {
      setSettings(settings)
    })
  }, [])

  const handleSaveSettingsButtonClick = useCallback(() => {
    emit<SaveSettingsHandler>('SAVE_SETTINGS', settings)
  }, [settings])

  return (
    <Stack space="large">
      <Stack space="small">
        <Text>Github access token</Text>
        <Textbox
          onInput={(e) => {
            setSettings((prevState) => ({
              ...prevState,
              GITHUB_ACCESS_TOKEN: e.currentTarget.value,
            }))
          }}
          value={settings.GITHUB_ACCESS_TOKEN ?? ''}
          variant="border"
        />
      </Stack>
      <Button onClick={handleSaveSettingsButtonClick}>Save settings</Button>
    </Stack>
  )
}

export default render(Plugin)
