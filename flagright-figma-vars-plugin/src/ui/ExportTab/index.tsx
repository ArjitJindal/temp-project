import { useCallback, useState } from 'preact/hooks'
import { emit } from '@create-figma-plugin/utilities'
import { ExportVariablesHandler } from '../../types'
import { Button, Columns, Dropdown } from '@create-figma-plugin/ui'
import { Fragment, h } from 'preact'
import { DEFAULT_SPACING } from '../const'
import Log from '../components/Log'
import s from './index.module.css'

export default function ActionsTab() {
  const [exportType, setExportType] = useState<'LESS' | 'TS'>('LESS')
  const handleExportButtonClick = useCallback(() => {
    emit<ExportVariablesHandler>('EXPORT_VARIABLES', exportType)
  }, [exportType])
  return (
    <Fragment>
      <Log />
      <div className={s.buttons}>
        <Dropdown
          variant={'border'}
          width={200}
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
        <Button onClick={handleExportButtonClick}>Export</Button>
      </div>
    </Fragment>
  )
}
