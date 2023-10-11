// NOTE: For white-label customers, add their console URLs here
export const WHITE_LABEL_ORIGINS = {
  bureau: {
    sandbox: 'https://tm.sandbox.bureau.id',
    prod: 'https://tm.bureau.id',
  },
  regtank: {
    sandbox: 'https://qc-staging.console.regtank.com',
    prod: 'https://transaction.console.regtank.com',
  },
  zigram: {
    sandbox: 'https://sandboxconsole.transactcomply.com/',
    prod: 'https://console.transactcomply.com/',
  },
}
export const ALLOWED_ORIGINS = {
  dev: ['*'],
  sandbox: [
    'https://sandbox.console.flagright.com',
    ...Object.values(WHITE_LABEL_ORIGINS).map((v) => v.sandbox),
  ],
  prod: [
    'https://console.flagright.com',
    'https://asia-1.console.flagright.com',
    'https://asia-2.console.flagright.com',
    'https://eu-1.console.flagright.com',
    ...Object.values(WHITE_LABEL_ORIGINS).map((v) => v.prod),
  ],
}
