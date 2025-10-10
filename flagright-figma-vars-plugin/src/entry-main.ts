import { emit, on, once, showUI } from '@create-figma-plugin/utilities'

import {
  CloseHandler,
  ExportVariablesHandler,
  LoadSettingsHandler,
  LogHandler,
  SaveSettingsHandler,
  Settings,
  SettingsUpdatedHandler,
  SyncVariablesHandler,
} from './types'
import { LESS_GENERATOR, serializeVariables, TS_GENERATOR } from './variables'
import { Request } from './request'
import { Api } from './api'
import { btoa } from './utils'

const prLabel = 'figma-vars-plugin'

export default function () {
  on<LoadSettingsHandler>('LOAD_SETTINGS', () => {
    try {
      const settings = readSettings()
      emit<SettingsUpdatedHandler>('SETTINGS_UPDATED', settings)
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
      emit<SettingsUpdatedHandler>('SETTINGS_UPDATED', settings)
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

      if (!settings.GITHUB_ACCESS_TOKEN) {
        throw new Error(
          `GITHUB_ACCESS_TOKEN is not set, unable to sync with Github`
        )
      }
      if (
        !settings.EXPORT_FILE_DIR ||
        !settings.EXPORT_FILE_BASE_NAME ||
        !settings.REPO_OWNER ||
        !settings.REPO_NAME ||
        !settings.REPO_BASE_BRANCH ||
        !settings.GITHUB_API_VERSION
      ) {
        console.error(
          `Settings missing required keys: ${JSON.stringify(settings)}`
        )
        throw new Error(`Settings are not complete`)
      }

      const request = new Request('https://api.github.com', {
        headers: {
          Authorization: 'Bearer ' + settings.GITHUB_ACCESS_TOKEN,
          'X-GitHub-Api-Version': settings.GITHUB_API_VERSION,
        },
      })
      const api = new Api(request, settings.REPO_OWNER, settings.REPO_NAME)
      const now = new Date()

      log('Export variables')
      const variablesLessText = await serializeVariables(LESS_GENERATOR)
      const variablesTsText = await serializeVariables(TS_GENERATOR)

      // Check if PR already exists
      const prs = await api.searchPrs({ filterLabels: [prLabel] })
      const filesToCommit: FileInfo[] = [
        {
          name: `${settings.EXPORT_FILE_DIR}/${settings.EXPORT_FILE_BASE_NAME}.less`,
          content: variablesLessText,
        },
        {
          name: `${settings.EXPORT_FILE_DIR}/${settings.EXPORT_FILE_BASE_NAME}.ts`,
          content: variablesTsText,
        },
      ]
      const newCommitMessage = `Changes from ${now.toISOString()} by ${figma.currentUser?.name}`

      if (prs.total_count > 0) {
        const [pr] = prs.items
        log(
          `PR already exist (#${pr.number}), checking for required changes to push...`
        )
        const prInfo = await api.getPr(pr.number)

        const changedFiles = await getChangedFiles(
          api,
          filesToCommit,
          prInfo.head.ref
        )

        if (changedFiles.length === 0) {
          log('Existed PR already contain all the changes!')
        } else {
          log('Create new commit with latest variables changes')
          const branch = await api.getBranch(prInfo.head.ref)
          const newCommit = await api.createCommit(branch.commit, {
            date: now,
            files: changedFiles,
            message: newCommitMessage,
          })

          log('Updating PR with a new commit')
          await api.updateBranch(prInfo.head.ref, newCommit)

          log(`PR updated! ${pr.html_url}`)
        }
      } else {
        const dateString = now
          .toISOString()
          .replace(/\..+$/g, '')
          .replace(/[^0-9]/g, '')

        const newBranchName = `figma-vars-plugin/${dateString}`

        // Get main branch
        log('Get main branch info...')
        const branchInfo = await api.getBranch(settings.REPO_BASE_BRANCH)

        const changedFiles = await getChangedFiles(
          api,
          filesToCommit,
          branchInfo.commit.sha
        )

        if (changedFiles.length === 0) {
          log('There are not changes to sync!')
        } else {
          log('Creating commit...')
          const newCommit = await api.createCommit(branchInfo.commit, {
            date: now,
            files: filesToCommit,
            message: newCommitMessage,
          })

          log('Creating branch...')
          await api.createBranch(newCommit, {
            branchName: newBranchName,
          })

          // Create PR
          log('Creating PR...')
          const newPr = await api.createPr({
            title: `Sync Figma changes with code`,
            body: `
            This PR created automatically from Figma, it is suppose to sync changes in Figma files with code

            Figma file: https://www.figma.com/design/${figma.fileKey}
          `
              .trim()
              .replace(/\s*\n+\s*/g, '\n'),
            head: newBranchName,
            base: settings.REPO_BASE_BRANCH,
            labels: [prLabel],
            draft: true,
          })

          log(`PR created: ${newPr.html_url}`)
        }
      }
      log(`Sync finished!`)
    } catch (e) {
      console.error(e)
      log(`ERROR: ${(e as Error).message}`)
    }
  })
  once<CloseHandler>('CLOSE', function () {
    figma.closePlugin()
  })
  showUI({
    height: 360,
    width: 640,
  })
}

interface FileInfo {
  name: string
  content: string
}

async function getChangedFiles(
  api: Api,
  files: FileInfo[],
  ref?: string
): Promise<FileInfo[]> {
  const changedFiles: FileInfo[] = []
  for (const file of files) {
    const result = await api.getFileContent(file.name, ref)
    if (result == null) {
      changedFiles.push(file)
    } else {
      const existedBase64 = result.content.replace(/\n/g, '')
      const fileBase64 = btoa(file.content)
      if (existedBase64 !== fileBase64) {
        changedFiles.push(file)
      }
    }
  }
  return changedFiles
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
