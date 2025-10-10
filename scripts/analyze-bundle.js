// @ts-nocheck
/* eslint-disable */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// Read the esbuild metafile
const meta = JSON.parse(fs.readFileSync('esbuild.json', 'utf8'))

console.log('📊 Exact Bundle Size by Route')
console.log('==============================')

// Extract route-to-component mappings from the routing file
const routeComponentMap = {
  '/dashboard': 'DashboardAnalysisPage',
  '/case-management': 'CaseManagementPage',
  '/case-management/case/:id': 'CaseManagementItemPage',
  '/case-management/alerts/:id': 'AlertItemPage',
  '/transactions': 'TransactionsListPage',
  '/transactions/item/:id': 'TransactionsItemPage',
  '/users': 'UsersUsersListPage',
  '/users/list/:list/:id': 'UsersItemPage',
  '/rules': 'RulesPage',
  '/rules/my-rules/:id': 'RuleInstancePage',
  '/rules/my-rules/:id/:mode': 'RulesItemPage',
  '/rules/rules-library/:id': 'RulesLibraryItemPage',
  '/reports': 'ReportsList',
  '/risk-levels': 'RiskFactorPage',
  '/risk-levels/configure': 'RiskLevelsConfigurePage',
  '/risk-levels/risk-factors': 'RiskFactorPage',
  '/risk-levels/risk-algorithms': 'RiskAlgorithmTable',
  '/lists': 'CreatedListsPage',
  '/lists/whitelist': 'CreatedListsPage',
  '/lists/blacklist': 'CreatedListsPage',
  '/lists/whitelist/:id': 'ListsItemPage',
  '/lists/blacklist/:id': 'ListsItemPage',
  '/screening': 'SanctionsPage',
  '/workflows': 'WorkflowsPage',
  '/workflows/:type/item/:id': 'WorkflowsItemPage',
  '/workflows/:type/create/:templateId': 'WorkflowsCreatePage',
  '/auditlog': 'AuditLogPage',
  '/ml-models': 'MlModelsPage',
  '/settings': 'SettingsPage',
  '/accounts': 'AccountsPage',
  '/accounts/roles/:roleId': 'AccountsRolesItemPage',
}

// Component to file path mappings (based on imports in routing file)
const componentFileMap = {
  DashboardAnalysisPage: 'src/pages/dashboard/analysis',
  CaseManagementPage: 'src/pages/case-management',
  CaseManagementItemPage: 'src/pages/case-management-item',
  AlertItemPage: 'src/pages/alert-item',
  TransactionsListPage: 'src/pages/transactions',
  TransactionsItemPage: 'src/pages/transactions-item',
  UsersUsersListPage: 'src/pages/users/users-list',
  UsersItemPage: 'src/pages/users-item',
  RulesPage: 'src/pages/rules',
  RuleInstancePage: 'src/pages/rules/rule-instance-page',
  RulesItemPage: 'src/pages/rules/rules-item',
  RulesLibraryItemPage: 'src/pages/rules/rules-library-item',
  ReportsList: 'src/pages/reports',
  RiskFactorPage: 'src/pages/risk-levels/risk-factors',
  RiskLevelsConfigurePage: 'src/pages/risk-levels/configure',
  RiskAlgorithmTable: 'src/pages/risk-levels/risk-algorithms',
  CreatedListsPage: 'src/pages/lists',
  ListsItemPage: 'src/pages/lists-item',
  SanctionsPage: 'src/pages/sanctions',
  WorkflowsPage: 'src/pages/workflows/workflows-page',
  WorkflowsItemPage: 'src/pages/workflows/workflows-item-page',
  WorkflowsCreatePage: 'src/pages/workflows/workflows-create-page',
  AuditLogPage: 'src/pages/auditlog',
  MlModelsPage: 'src/pages/ml-models',
  SettingsPage: 'src/pages/settings',
  AccountsPage: 'src/pages/accounts',
  AccountsRolesItemPage: 'src/pages/accounts/RolesV2/AccountsRolesItemPage',
}

function formatSize(bytes) {
  const mb = bytes / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`
}

// Analyze the metafile to understand chunk dependencies
const outputs = meta.outputs
const inputs = meta.inputs

// Find the main bundle
const mainBundleEntries = Object.entries(outputs).filter(
  ([path]) => path.includes('bundle-') && path.endsWith('.js')
)
const mainBundle = mainBundleEntries.reduce(
  (sum, [, data]) => sum + data.bytes,
  0
)
const mainBundleBrotli = mainBundleEntries.reduce(
  (sum, [path]) => sum + brotliSize(path),
  0
)

// Calculate total bundle size
const totalJS = Object.entries(outputs)
  .filter(([path]) => path.endsWith('.js'))
  .reduce((sum, [, data]) => sum + data.bytes, 0)

// NEW: calculate CSS size
const totalCSS = Object.entries(outputs)
  .filter(([outPath]) => outPath.endsWith('.css'))
  .reduce((sum, [, data]) => sum + data.bytes, 0)

function brotliSize(filePath) {
  if (!global.__brotliSizeCache) {
    global.__brotliSizeCache = new Map()
  }
  const cache = global.__brotliSizeCache
  if (cache.has(filePath)) return cache.get(filePath)
  let size = 0
  try {
    const buff = fs.readFileSync(filePath)
    size = zlib.brotliCompressSync(buff).length
  } catch (_) {
    size = 0
  }
  cache.set(filePath, size)
  return size
}

// Calculate brotli-compressed sizes for JS & CSS
let jsBrotli = 0
let cssBrotli = 0
Object.entries(outputs).forEach(([outPath, _data]) => {
  if (outPath.endsWith('.js')) {
    jsBrotli += brotliSize(outPath)
  } else if (outPath.endsWith('.css')) {
    cssBrotli += brotliSize(outPath)
  }
})

const totalRaw = totalJS + totalCSS
const totalBrotli = jsBrotli + cssBrotli

// Function to find which chunks a component/route uses
function getRouteChunks(componentPath) {
  const chunks = new Set()
  const chunkSizes = new Map()
  const chunkSizesBrotli = new Map()

  // Find all chunks that include this component or its dependencies
  Object.entries(outputs).forEach(([outputPath, outputData]) => {
    if (!outputPath.endsWith('.js')) return

    if (outputData.inputs) {
      Object.keys(outputData.inputs).forEach((inputPath) => {
        // Check if this input is related to our component
        if (
          inputPath.includes(componentPath) ||
          inputPath.includes(componentPath.replace(/\//g, path.sep))
        ) {
          chunks.add(outputPath)
          chunkSizes.set(outputPath, outputData.bytes)
          chunkSizesBrotli.set(outputPath, brotliSize(outputPath))
        }
      })
    }
  })

  return { chunks: Array.from(chunks), chunkSizes, chunkSizesBrotli }
}

// Function to get heavy dependencies for a route
function getHeavyDependencies(componentPath) {
  const dependencies = new Set()

  // Look through inputs to find node_modules dependencies
  Object.entries(inputs).forEach(([inputPath, inputData]) => {
    if (inputPath.includes('node_modules') && inputData.bytes > 100 * 1024) {
      // >100KB
      // Check if this dependency is used by our component
      Object.entries(outputs).forEach(([outputPath, outputData]) => {
        if (outputData.inputs && outputData.inputs[inputPath]) {
          // Check if this output chunk is related to our component
          if (
            Object.keys(outputData.inputs).some(
              (inp) =>
                inp.includes(componentPath) ||
                inp.includes(componentPath.replace(/\//g, path.sep))
            )
          ) {
            const match = inputPath.match(/node_modules\/([^\/]+)/)
            if (match) {
              dependencies.add({
                name: match[1],
                size: inputData.bytes,
                chunk: outputPath,
              })
            }
          }
        }
      })
    }
  })

  return Array.from(dependencies).sort((a, b) => b.size - a.size)
}

console.log(`Main Bundle (shared): ${formatSize(mainBundle)}`)
console.log('')

// Function to collect initial-load chunks (static import graph) for a given entry chunk
function collectInitialChunks(entryChunks) {
  const visited = new Set()

  function dfs(chunkPath) {
    if (visited.has(chunkPath)) return
    visited.add(chunkPath)

    const chunkMeta = outputs[chunkPath]
    if (!chunkMeta || !chunkMeta.imports) return

    chunkMeta.imports.forEach(({ path: importPath, kind }) => {
      if (kind === 'import-statement') {
        // static
        dfs(importPath)
      }
    })
  }

  entryChunks.forEach((c) => dfs(c))
  return Array.from(visited)
}

// Analyze each route
const routeAnalysis = []

Object.entries(routeComponentMap).forEach(([route, component]) => {
  const componentPath = componentFileMap[component]
  if (!componentPath) {
    routeAnalysis.push({
      route,
      component,
      size: mainBundle, // Default to main bundle if we can't find specific chunks
      chunks: [],
      dependencies: [],
    })
    return
  }

  const { chunks, chunkSizes, chunkSizesBrotli } = getRouteChunks(componentPath)
  const dependencies = getHeavyDependencies(componentPath)

  // Calculate route sizes
  const routeSpecificSize = chunks.reduce(
    (sum, chunk) => sum + (chunkSizes.get(chunk) || 0),
    0
  )
  const routeSpecificBrotli = chunks.reduce(
    (sum, chunk) => sum + (chunkSizesBrotli.get(chunk) || 0),
    0
  )
  // Initial-load chunks (static imports only)
  const initialChunks = collectInitialChunks(chunks)
  const initialRouteBrotli = initialChunks.reduce(
    (s, c) => s + brotliSize(c),
    0
  )
  const initialSizeBrotli = mainBundleBrotli + initialRouteBrotli

  const totalRouteSize = mainBundle + totalCSS + routeSpecificSize
  const totalRouteBrotli = mainBundleBrotli + cssBrotli + routeSpecificBrotli

  routeAnalysis.push({
    route,
    component,
    sizeRaw: totalRouteSize,
    sizeBrotli: totalRouteBrotli,
    initialSizeBrotli,
    routeSpecificSizeRaw: routeSpecificSize,
    routeSpecificSizeBrotli: routeSpecificBrotli,
    chunks,
    dependencies,
  })
})

// Sort routes by size
routeAnalysis.sort((a, b) => b.initialSizeBrotli - a.initialSizeBrotli)

// Display results
routeAnalysis.forEach((analysis) => {
  const routeSpecific =
    analysis.routeSpecificSizeBrotli > 0
      ? ` (+${formatSize(analysis.routeSpecificSizeBrotli)} after interaction)`
      : ''

  console.log(
    `${analysis.route.padEnd(30)} ${formatSize(analysis.initialSizeBrotli)}${routeSpecific}`
  )

  // Show heavy dependencies if any
  if (analysis.dependencies.length > 0) {
    const topDeps = analysis.dependencies.slice(0, 3)
    const depStr = topDeps
      .map((d) => `${d.name}(${formatSize(d.size)})`)
      .join(', ')
    console.log(`${' '.repeat(32)}└─ Heavy deps: ${depStr}`)
  }
})

console.log('')
console.log(`Total JavaScript: ${formatSize(jsBrotli)}`)
console.log(`Total CSS       : ${formatSize(cssBrotli)}`)
console.log(`------------------------------`)
console.log(`Total Bundle    : ${formatSize(totalBrotli)}`)

// Find the heaviest routes
const heaviestRoutes = routeAnalysis.slice(0, 5)
console.log('')
console.log('🚨 Heaviest Routes:')
heaviestRoutes.forEach((route, index) => {
  console.log(
    `${index + 1}. ${route.route} - ${formatSize(route.initialSizeBrotli)}`
  )
})
