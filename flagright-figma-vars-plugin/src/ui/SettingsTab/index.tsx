import { useCallback, useEffect, useState } from 'preact/hooks'
import { Fragment, h } from 'preact'
import cn from 'clsx'
import { ButtonProps } from '@create-figma-plugin/ui/lib/components/button/button'
import { isEqual } from 'lodash'
import {
  LoadSettingsHandler,
  SaveSettingsHandler,
  Settings,
  SettingsUpdatedHandler,
} from '../../types'
import { emit, on } from '@create-figma-plugin/utilities'
import { Button, Stack, Text, Textbox } from '@create-figma-plugin/ui'
import { humanizeAuto } from '@flagright/lib/utils/humanize'
import s from './index.module.css'

export default function SettingsTab() {
  const [loadedSettings, setLoadedSettings] = useState<Settings>({})
  const [settings, setSettings] = useState<Settings>({})
  const isSettingsChanged = !isEqual(settings, loadedSettings)

  useEffect(() => {
    return on<SettingsUpdatedHandler>('SETTINGS_UPDATED', (settings) => {
      setSettings(settings)
      setLoadedSettings(settings)
    })
  }, [])

  useEffect(() => {
    emit<LoadSettingsHandler>('LOAD_SETTINGS')
  }, [])

  const handleSaveSettingsButtonClick = useCallback(() => {
    emit<SaveSettingsHandler>('SAVE_SETTINGS', settings)
  }, [settings])

  const handleResetSettingsButtonClick = useCallback(() => {
    emit<LoadSettingsHandler>('LOAD_SETTINGS')
  }, [settings])

  const keys: (keyof Settings)[] = [
    'GITHUB_ACCESS_TOKEN',
    'EXPORT_FILE_DIR',
    'EXPORT_FILE_BASE_NAME',
    'REPO_OWNER',
    'REPO_NAME',
    'REPO_BASE_BRANCH',
    'GITHUB_API_VERSION',
  ]

  return (
    <Stack space="large">
      <div className={s.inputs}>
        {keys.map((key) => (
          <Stack space="small" key={key}>
            <Text>
              <label for={key}>{humanizeAuto(key)}</label>
            </Text>
            <input
              id={key}
              className={cn(s.input, !settings[key] && s.isInvalid)}
              onInput={(e) => {
                setSettings((prevState) => ({
                  ...prevState,
                  [key]: e.currentTarget.value,
                }))
              }}
              value={settings[key] ?? ''}
            />
          </Stack>
        ))}
      </div>
      <div className={s.buttons}>
        <Button
          onClick={handleSaveSettingsButtonClick}
          disabled={!isSettingsChanged}
        >
          Save settings
        </Button>
        <Button
          secondary
          disabled={!isSettingsChanged}
          onClick={handleResetSettingsButtonClick}
        >
          Reset
        </Button>
        <FileUploadButton
          secondary
          onSelectedFiles={async (files: Array<File>) => {
            const file = files[0]
            if (file) {
              try {
                const fileContent = await file.text()
                const settings = JSON.parse(fileContent)
                setSettings(settings)
              } catch (e) {
                console.error('Unable to parse settings file', e)
              }
            }
          }}
        >
          Import from file...
        </FileUploadButton>
      </div>
    </Stack>
  )
}

function FileUploadButton(
  props: Omit<ButtonProps, 'onClick'> & {
    onSelectedFiles: (files: File[]) => void
  }
) {
  const [id] = useState(
    `FileUploadButton-${Math.round(Math.random() * Number.MAX_SAFE_INTEGER)}`
  )
  return (
    <Fragment>
      <input
        type={'file'}
        id={id}
        style={{ position: 'absolute', top: -1000, visibility: 'hidden' }}
        onChange={(e) => {
          props.onSelectedFiles(Array.from(e.currentTarget.files ?? []))
          e.currentTarget.value = ''
        }}
      />
      <Button
        {...props}
        onClick={() => {
          document.getElementById(id)?.click()
        }}
      />
    </Fragment>
  )
}
