export type Secrets = {
  mongoAtlasCreds: {
    username: string
    password: string
    host: string
  }
  clueso: {
    privateKey: string
  }
  complyAdvantageCreds: { apiKey: string }
  openAI: string
  ibanapiCreds: { apiKey: string }
  apininjasCreds: { apiKey: string }
  IntegrationKey: string
  GoogleSheetsPrivateKey: { privateKey: string }
  MerchantMonitoring: {
    companiesHouse: string
    rapidApi: string
    scrapfly: string
    explorium: string
  }
  fincenCreds: { username: string; password: string }
  githubCreds: { auth: string }
}

export type SecretName = keyof Secrets
