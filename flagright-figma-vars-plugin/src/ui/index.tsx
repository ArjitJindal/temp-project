import { useEffect, useState } from 'preact/hooks'
import { on } from '@create-figma-plugin/utilities'
import { LogHandler } from '../types'
import s from './index.module.css'
import { Tabs } from '@create-figma-plugin/ui'
import { Fragment, h } from 'preact'
import SyncTab from './SyncTab'
import ExportTab from './ExportTab'
import SettingsTab from './SettingsTab'

export default function UI() {
  const [tab, setTab] = useState<string>('Sync')

  return (
    <div className={s.root}>
      <div className={s.header}>
        <Tabs
          onChange={(event) => {
            const newValue = event.currentTarget.value
            setTab(newValue)
          }}
          options={[
            {
              children: <Fragment></Fragment>,
              value: 'Sync',
            },
            {
              children: <Fragment></Fragment>,
              value: 'Export',
            },
            {
              children: <Fragment></Fragment>,
              value: 'Settings',
            },
          ]}
          value={tab}
        />
      </div>
      <div className={s.tabContent}>
        {tab === 'Sync' && <SyncTab />}
        {tab === 'Export' && <ExportTab />}
        {tab === 'Settings' && <SettingsTab />}
      </div>
    </div>
  )
}
