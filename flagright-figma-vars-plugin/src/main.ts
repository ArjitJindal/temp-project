import { emit, on, once, showUI } from '@create-figma-plugin/utilities'

import {
  CloseHandler,
  ExportVariablesHandler,
  LoadSettingsHandler,
  LoadSettingsResultHandler,
  LogHandler,
  SaveSettingsHandler,
  Settings,
  SyncVariablesHandler,
} from './types'
import { LESS_GENERATOR, serializeVariables, TS_GENERATOR } from './variables'
import { Request } from './request'
import { Api } from './api'

const FILE_PATH_LESS = 'phytoplankton-console/src/components/ui/figma-vars.less'
const FILE_PATH_TS = 'phytoplankton-console/src/components/ui/figma-vars.ts'
const OWNER = 'flagright'
const REPO = `orca`
const BASE_BRANCH = `main`
const GITHUB_API_VERSION = '2022-11-28'

export default function () {
  on<LoadSettingsHandler>('LOAD_SETTINGS', () => {
    try {
      const settings = readSettings()
      emit<LoadSettingsResultHandler>('LOAD_SETTINGS_RESULT', settings)
    } catch (e) {
      console.error(e)
      log(`ERROR: ${(e as Error).message}`)
    }
  })
  on<SaveSettingsHandler>('SAVE_SETTINGS', (settings) => {
    try {
      logClean()
      saveSettings(settings)
      log('New settings saved')
    } catch (e) {
      console.error(e)
      log(`ERROR: ${(e as Error).message}`)
    }
  })
  on<ExportVariablesHandler>(
    'EXPORT_VARIABLES',
    async (type: 'LESS' | 'TS') => {
      try {
        let output: string
        if (type === 'LESS') {
          output = await serializeVariables(LESS_GENERATOR)
        } else {
          output = await serializeVariables(TS_GENERATOR)
        }
        logClean()
        log(output)
      } catch (e) {
        console.error(e)
        log(`ERROR: ${(e as Error).message}`)
      }
    }
  )
  on<SyncVariablesHandler>('SYNC_VARIABLES', async () => {
    logClean()

    try {
      const settings = readSettings()
      if (
        settings.GITHUB_ACCESS_TOKEN == null ||
        settings.GITHUB_ACCESS_TOKEN === ''
      ) {
        throw new Error(`GITHUB_ACCESS_TOKEN is not set`)
      }

      const request = new Request('https://api.github.com', {
        headers: {
          Authorization: 'Bearer ' + settings.GITHUB_ACCESS_TOKEN,
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
        },
      })
      const api = new Api(request, OWNER, REPO)
      const now = new Date()

      log('Export variables')
      const variablesLessText = await serializeVariables(LESS_GENERATOR)
      const variablesTsText = await serializeVariables(TS_GENERATOR)

      // Check if PR already exists
      const prTitlePrefix = '[Figma]'
      const prs = await api.searchPrs({ filterTitle: prTitlePrefix })
      const newCommitMessage = `Changes from ${now.toISOString()} by ${figma.currentUser?.name}`
      const newCommitFiles = [
        {
          name: FILE_PATH_LESS,
          content: variablesLessText,
        },
        {
          name: FILE_PATH_TS,
          content: variablesTsText,
        },
      ]
      if (prs.total_count > 0) {
        log('PR already exist')
        const [pr] = prs.items
        const prInfo = await api.getPr(pr.number)

        log('Create new commit with latest variables changes')
        const branch = await api.getBranch(prInfo.head.ref)
        const newCommit = await api.createCommit(branch.commit, {
          date: now,
          files: newCommitFiles,
          message: newCommitMessage,
        })

        log('Updating PR with a new commit')
        await api.updateBranch(prInfo.head.ref, newCommit)

        log(`PR updated! ${pr.html_url}`)
      } else {
        const dateString = now
          .toISOString()
          .replace(/\..+$/g, '')
          .replace(/[^0-9]/g, '')

        const BRANCH_NAME = `figma/sync/${dateString}`

        // Get main branch
        log('Get main branch info...')
        const branchInfo = await api.getBranch(BASE_BRANCH)

        log('Creating commit...')
        const newCommit = await api.createCommit(branchInfo.commit, {
          date: now,
          files: newCommitFiles,
          message: newCommitMessage,
        })

        log('Creating branch...')
        await api.createBranch(newCommit, {
          branchName: BRANCH_NAME,
        })

        // Create PR
        log('Creating PR...')
        const newPr = await api.createPr({
          title: `${prTitlePrefix} Sync Figma changes with code`,
          body: `
            This PR created automatically from Figma, it is suppose to sync changes in Figma files with code
            
            Figma file: https://www.figma.com/design/${figma.fileKey}
          `
            .trim()
            .replace(/\s*\n+\s*/g, '\n'),
          head: BRANCH_NAME,
          base: BASE_BRANCH,
          draft: false,
        })

        log(`PR created: ${newPr.html_url}`)
      }
    } catch (e) {
      console.error(e)
      log(`ERROR: ${(e as Error).message}`)
    }
  })
  once<CloseHandler>('CLOSE', function () {
    figma.closePlugin()
  })
  showUI({
    height: 320,
    width: 640,
  })
}

function saveSettings(settings: Settings): void {
  try {
    figma.root.setPluginData('SETTINGS', JSON.stringify(settings))
  } catch (e) {
    console.error(e)
    throw new Error('Unable to save settings')
  }
}
function readSettings(): Settings {
  try {
    return JSON.parse(figma.root.getPluginData('SETTINGS') || '{}')
  } catch (e) {
    console.error('Unable to load settings', e)
  }
  return {}
}

function log(text: string) {
  emit<LogHandler>('LOG', 'INFO', text)
}

function logClean() {
  emit<LogHandler>('LOG', 'CLEAN')
}
