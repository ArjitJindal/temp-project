// NOTE: For white-label customers, add their console URLs here
export const WHITE_LABEL_ORIGINS = {
  bureau: {
    sandbox: 'https://tm.sandbox.bureau.id',
    prod: 'https://tm.bureau.id',
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
    ...Object.values(WHITE_LABEL_ORIGINS).map((v) => v.prod),
  ],
}
