// https://umijs.org/config/
import { defineConfig } from 'umi';

export default defineConfig({
  plugins: [
    // https://github.com/zthxxx/react-dev-inspector
    'react-dev-inspector/plugins/umi/react-inspector',
  ],
  // https://github.com/zthxxx/react-dev-inspector#inspector-loader-props
  inspectorConfig: {
    exclude: [],
    babelPlugins: [],
    babelOptions: {},
  },
  define: {
    EXPORT_ENTRIES_LIMIT: 10000,
    API_BASE_PATH: undefined,
    AUTH0_AUDIENCE: undefined,
    AUTH0_DOMAIN: 'login.dev.console.flagright.com',
    AUTH0_CLIENT_ID: 'uGGbVNumU7d57NswPLD5UaTwvf17tc7y',
    SEGMENT_WRITE_KEY: 'hq92BB0TxSCSqnZEMbkhs45N4x3rH1Vx',
    FEATURES_ENABLED: [],
  },
});
