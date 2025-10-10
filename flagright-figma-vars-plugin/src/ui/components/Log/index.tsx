import { useEffect, useState } from 'preact/hooks'
import { on } from '@create-figma-plugin/utilities'
import { LogHandler } from '../../../types'
import s from './index.module.css'
import { h } from 'preact'

export default function Log() {
  const [log, setLog] = useState('')

  useEffect(() => {
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

  return (
    <textarea
      className={s.log}
      value={log}
      style={{ height: 100 }}
      placeholder={'No actions performed yet'}
      readOnly
    />
  )
}
