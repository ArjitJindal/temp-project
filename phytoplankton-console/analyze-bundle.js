const fs = require('fs');
const path = require('path');

// Read the esbuild metafile
const meta = JSON.parse(fs.readFileSync('esbuild.json', 'utf8'));

console.log('📊 Exact Bundle Size by Route');
console.log('==============================');

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
};

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
};

function formatSize(bytes) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
}

// Analyze the metafile to understand chunk dependencies
const outputs = meta.outputs;
const inputs = meta.inputs;

// Find the main bundle
const mainBundle = Object.entries(outputs)
  .filter(([path]) => path.includes('bundle-') && path.endsWith('.js'))
  .reduce((sum, [, data]) => sum + data.bytes, 0);

// Calculate total bundle size
const totalJS = Object.entries(outputs)
  .filter(([path]) => path.endsWith('.js'))
  .reduce((sum, [, data]) => sum + data.bytes, 0);

// Function to find which chunks a component/route uses
function getRouteChunks(componentPath) {
  const chunks = new Set();
  const chunkSizes = new Map();

  // Find all chunks that include this component or its dependencies
  Object.entries(outputs).forEach(([outputPath, outputData]) => {
    if (!outputPath.endsWith('.js')) return;

    if (outputData.inputs) {
      Object.keys(outputData.inputs).forEach((inputPath) => {
        // Check if this input is related to our component
        if (
          inputPath.includes(componentPath) ||
          inputPath.includes(componentPath.replace(/\//g, path.sep))
        ) {
          chunks.add(outputPath);
          chunkSizes.set(outputPath, outputData.bytes);
        }
      });
    }
  });

  return { chunks: Array.from(chunks), chunkSizes };
}

// Function to get heavy dependencies for a route
function getHeavyDependencies(componentPath) {
  const dependencies = new Set();

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
                inp.includes(componentPath) || inp.includes(componentPath.replace(/\//g, path.sep)),
            )
          ) {
            const match = inputPath.match(/node_modules\/([^\/]+)/);
            if (match) {
              dependencies.add({
                name: match[1],
                size: inputData.bytes,
                chunk: outputPath,
              });
            }
          }
        }
      });
    }
  });

  return Array.from(dependencies).sort((a, b) => b.size - a.size);
}

console.log(`Main Bundle (shared): ${formatSize(mainBundle)}`);
console.log('');

// Analyze each route
const routeAnalysis = [];

Object.entries(routeComponentMap).forEach(([route, component]) => {
  const componentPath = componentFileMap[component];
  if (!componentPath) {
    routeAnalysis.push({
      route,
      component,
      size: mainBundle, // Default to main bundle if we can't find specific chunks
      chunks: [],
      dependencies: [],
    });
    return;
  }

  const { chunks, chunkSizes } = getRouteChunks(componentPath);
  const dependencies = getHeavyDependencies(componentPath);

  // Calculate total size for this route (main bundle + route-specific chunks)
  const routeSpecificSize = chunks.reduce((sum, chunk) => sum + (chunkSizes.get(chunk) || 0), 0);
  const totalRouteSize = mainBundle + routeSpecificSize;

  routeAnalysis.push({
    route,
    component,
    size: totalRouteSize,
    routeSpecificSize,
    chunks,
    dependencies,
  });
});

// Sort routes by size
routeAnalysis.sort((a, b) => b.size - a.size);

// Display results
routeAnalysis.forEach((analysis) => {
  const routeSpecific =
    analysis.routeSpecificSize > 0
      ? ` (+${formatSize(analysis.routeSpecificSize)} route-specific)`
      : '';

  console.log(`${analysis.route.padEnd(30)} ${formatSize(analysis.size)}${routeSpecific}`);

  // Show heavy dependencies if any
  if (analysis.dependencies.length > 0) {
    const topDeps = analysis.dependencies.slice(0, 3);
    const depStr = topDeps.map((d) => `${d.name}(${formatSize(d.size)})`).join(', ');
    console.log(`${' '.repeat(32)}└─ Heavy deps: ${depStr}`);
  }
});

console.log('');
console.log(`Total Bundle Size: ${formatSize(totalJS)}`);

// Find the heaviest routes
const heaviestRoutes = routeAnalysis.slice(0, 5);
console.log('');
console.log('🚨 Heaviest Routes:');
heaviestRoutes.forEach((route, index) => {
  console.log(`${index + 1}. ${route.route} - ${formatSize(route.size)}`);
});
