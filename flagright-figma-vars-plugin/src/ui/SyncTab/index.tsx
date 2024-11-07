import { useCallback, useState } from 'preact/hooks'
import { emit } from '@create-figma-plugin/utilities'
import { ExportVariablesHandler, SyncVariablesHandler } from '../../types'
import { Button } from '@create-figma-plugin/ui'
import { Fragment, h } from 'preact'
import Log from '../components/Log'

export default function ActionsTab() {
  const [exportType, setExportType] = useState<'LESS' | 'TS'>('LESS')
  const handleSyncWithGithubClick = useCallback(() => {
    emit<SyncVariablesHandler>('SYNC_VARIABLES')
  }, [])
  const handleExportButtonClick = useCallback(() => {
    emit<ExportVariablesHandler>('EXPORT_VARIABLES', exportType)
  }, [exportType])
  return (
    <Fragment>
      <Log />
      <div>
        <Button onClick={handleSyncWithGithubClick}>Sync with GitHub</Button>
      </div>
    </Fragment>
  )
}
