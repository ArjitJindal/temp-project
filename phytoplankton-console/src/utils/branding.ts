import FlagrightLogoSvg from '@/branding/flagright-logo.svg';
import FlagrightDemoLogoSvg from '@/branding/flagright-logo-demo.svg';
import FlagrightNoTextLogo from '@/branding/flagright-no-text.svg';
import FlagrightFavicon from '@/branding/flagright-favicon.png';
import BureauLogoSvg from '@/branding/bureau-logo.svg';
import BureauFaviconSvg from '@/branding/bureau-favicon.svg';
import RegtankLogoSvg from '@/branding/regtank-logo.svg';
import RegtankFaviconSvg from '@/branding/regtank-favicon.svg';
import ZigramLogo from '@/branding/zigram-logo-white.png';
import ZigramFavicon from '@/branding/zigram-favicon.png';
import TraxionRightLogo from '@/branding/traxionright-logo.png';
import TraxionRightFavicon from '@/branding/traxionright-favicon.png';

interface BrandingSettings {
  apiBasePath?: string;
  auth0Domain: string;
  auth0ClientId: string;
  supportEmail: string;
  companyName: string;
  logoUrl: string;
  demoModeLogoUrl?: string;
  knowledgeBaseUrl?: string;
  notProvisionedWarning: string;
  apiDocsLinks: {
    webhooks: string;
  };
  redirectPath?: string;
  faviconUrl: string;
  systemAvatarUrl?: string;
}

const FLAGRIGHT_BRANDING: BrandingSettings = {
  auth0Domain: AUTH0_DOMAIN,
  auth0ClientId: AUTH0_CLIENT_ID,
  supportEmail: 'support@flagright.com',
  logoUrl: FlagrightLogoSvg,
  companyName: 'Flagright',
  demoModeLogoUrl: FlagrightDemoLogoSvg,
  knowledgeBaseUrl: 'https://www.support.flagright.com/knowledge',
  notProvisionedWarning: `User does not have a provisioned Flagright Account. If your organization already uses Flagright, please ask your Flagright Console Admin to add you to the Console. If you are not a Flagright customer yet, please contact Flagright Sales Team at hello@flagright.com`,
  apiDocsLinks: {
    webhooks: 'https://docs.flagright.com/docs/flagright-api/0b0bb2cf007e5-webhooks-overview',
  },
  faviconUrl: FlagrightFavicon,
  systemAvatarUrl: FlagrightNoTextLogo,
};

const BUREAU_BRANDING: Omit<BrandingSettings, 'auth0Domain' | 'auth0ClientId'> = {
  supportEmail: 'helpdesk@bureau.id',
  logoUrl: BureauLogoSvg,
  demoModeLogoUrl: BureauLogoSvg,
  companyName: 'Bureau',
  notProvisionedWarning: `User does not have a provisioned Bureau Account.`,
  apiDocsLinks: {
    webhooks: 'https://docs.flagright.com/docs/flagright-api/0b0bb2cf007e5-webhooks-overview',
  },
  // TODO: We can remove `redirectPath` here after https://tm.sandbox.bureau.id is correctly redirectly to Console.
  redirectPath: '/dashboard/analysis',
  faviconUrl: BureauFaviconSvg,
  systemAvatarUrl: BureauFaviconSvg,
};

const REGTANK_BRANDING: Omit<BrandingSettings, 'auth0Domain' | 'auth0ClientId'> = {
  // TBD
  supportEmail: 'support@regtank.com',
  logoUrl: RegtankLogoSvg,
  demoModeLogoUrl: RegtankLogoSvg,
  companyName: 'Regtank',
  notProvisionedWarning: `User does not have a provisioned Regtank Account.`,
  apiDocsLinks: {
    webhooks: 'https://docs.flagright.com/docs/flagright-api/0b0bb2cf007e5-webhooks-overview',
  },
  faviconUrl: RegtankFaviconSvg,
  systemAvatarUrl: RegtankFaviconSvg,
};

const ZIGRAM_BRANDING: Omit<BrandingSettings, 'auth0Domain' | 'auth0ClientId'> = {
  supportEmail: 'tmsupport@zigram.tech',
  logoUrl: ZigramLogo,
  demoModeLogoUrl: ZigramLogo,
  companyName: 'Transact Comply',
  notProvisionedWarning: `User does not have a provisioned Transact Comply Account.`,
  apiDocsLinks: {
    webhooks: 'https://docs.flagright.com/docs/flagright-api/0b0bb2cf007e5-webhooks-overview',
  },
  faviconUrl: ZigramFavicon,
  systemAvatarUrl: ZigramFavicon,
};

const TRAXIONRIGHT_BRANDING: Omit<BrandingSettings, 'auth0Domain' | 'auth0ClientId'> = {
  supportEmail: 'support@traxionright.com',
  logoUrl: TraxionRightLogo,
  demoModeLogoUrl: TraxionRightLogo,
  companyName: 'Traxion right',
  notProvisionedWarning: `User does not have a provisioned Traxion right Account.`,
  apiDocsLinks: {
    webhooks: 'https://docs.flagright.com/docs/flagright-api/0b0bb2cf007e5-webhooks-overview',
  },
  faviconUrl: TraxionRightFavicon,
  systemAvatarUrl: TraxionRightFavicon,
};

const WHITELABEL_BRANDING = {
  'tm.bureau.id': {
    ...BUREAU_BRANDING,
    auth0Domain: 'login.tm.bureau.id',
    auth0ClientId: 'XFllobU2SratClHKFrSfVSROlpRH8rUm',
  },
  'tm.sandbox.bureau.id': {
    ...BUREAU_BRANDING,
    auth0Domain: 'login.tm.sandbox.bureau.id',
    auth0ClientId: 'JJHmTg7oupG4tUZRDpvAlghJvvVnbyoc',
  },
  'qc-staging.console.regtank.com': {
    ...REGTANK_BRANDING,
    auth0Domain: 'login.qc-staging.console.regtank.com',
    auth0ClientId: 'Nz37vE2YAvMRPAIsqLVXcfACo216CMXE',
  },
  'sandboxconsole.transactcomply.com': {
    ...ZIGRAM_BRANDING,
    auth0Domain: 'login.sandboxconsole.transactcomply.com',
    auth0ClientId: 'qW5HsNLzyfKoKlG8orZza1EQBUqTxfj6',
  },
  'transaction.console.regtank.com': {
    ...REGTANK_BRANDING,
    auth0Domain: 'login.transaction.console.regtank.com',
    auth0ClientId: 'nVwFjIjOIyrzQfLtkUXo7sdxODGuHfvc',
  },
  'sitapp.traxionright.com': {
    ...TRAXIONRIGHT_BRANDING,
    auth0Domain: 'login.sitapp.traxionright.com',
    auth0ClientId: 'wJuiiS6bbcGhSMnqC442RL8HKHfMUI4n',
  },
  'app.traxionright.com': {
    ...TRAXIONRIGHT_BRANDING,
    auth0Domain: 'login.app.traxionright.com',
    auth0ClientId: '6k9yUXtYFG9WTjsuEhe4LahCD8Q9W8x6',
  },
};

export function getBranding(): BrandingSettings {
  const whitelabelBranding = WHITELABEL_BRANDING[window.location.hostname];
  return whitelabelBranding ?? FLAGRIGHT_BRANDING;
}

export function isWhiteLabeled(): boolean {
  return getBranding().companyName !== 'Flagright';
}
