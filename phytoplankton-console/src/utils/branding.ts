import FlagrightLightLogo from '@/branding/flagright-logo-light.svg';
import FlagrightDarkLogo from '@/branding/flagright-logo-dark.svg';
import BureauLightLogo from '@/branding/bureau-logo-light.svg';
import BureauDarkLogo from '@/branding/bureau-logo-dark.svg';
import RegtankLightLogo from '@/branding/regtank-logo-light.svg';
import RegtankDarkLogo from '@/branding/regtank-logo-dark.svg';
import ZigramLightLogo from '@/branding/zigram-logo-light.png';
import ZigramDarkLogo from '@/branding/zigram-logo-dark.svg';
import TraxionRightLightLogo from '@/branding/traxionright-logo-light.png';
import TraxionRightDarkLogo from '@/branding/traxion-logo-dark.svg';
import BureauFaviconSvg from '@/branding/bureau-favicon.svg';
import FlagrightFavicon from '@/branding/flagright-favicon.png';
import FlagrightNoTextLogo from '@/branding/flagright-no-text.svg';
import RegtankFaviconSvg from '@/branding/regtank-favicon.svg';
import ZigramFaivcon from '@/branding/zigram-favicon.png';
import TraxionRightFavicon from '@/branding/traxion-favicon.svg';

interface BrandingSettings {
  apiBasePath?: string;
  auth0Domain: string;
  auth0ClientId: string;
  supportEmail: string;
  companyName: string;
  logoLight: string;
  logoDark: string;
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
  logoLight: FlagrightLightLogo,
  companyName: 'Flagright',
  logoDark: FlagrightDarkLogo,
  knowledgeBaseUrl:
    process.env.ENV_NAME === 'sandbox'
      ? 'https://sandbox.support.flagright.com/'
      : 'https://support.flagright.com/',
  notProvisionedWarning: `User does not have a provisioned Flagright Account. If your organization already uses Flagright, please ask your Flagright Console Admin to add you to the Console. If you are not a Flagright customer yet, please contact Flagright Sales Team at hello@flagright.com`,
  apiDocsLinks: {
    webhooks: 'https://docs.flagright.com/docs/flagright-api/0b0bb2cf007e5-webhooks-overview',
  },
  faviconUrl: FlagrightFavicon,
  systemAvatarUrl: FlagrightNoTextLogo,
};

const BUREAU_BRANDING: Omit<BrandingSettings, 'auth0Domain' | 'auth0ClientId'> = {
  supportEmail: 'helpdesk@bureau.id',
  logoLight: BureauLightLogo,
  logoDark: BureauDarkLogo,
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
  logoLight: RegtankLightLogo,
  logoDark: RegtankDarkLogo,
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
  logoLight: ZigramLightLogo,
  logoDark: ZigramDarkLogo,
  companyName: 'Transact Comply',
  notProvisionedWarning: `User does not have a provisioned Transact Comply Account.`,
  apiDocsLinks: {
    webhooks: 'https://docs.flagright.com/docs/flagright-api/0b0bb2cf007e5-webhooks-overview',
  },
  faviconUrl: ZigramFaivcon,
  systemAvatarUrl: ZigramFaivcon,
};

const TRAXIONRIGHT_BRANDING: Omit<BrandingSettings, 'auth0Domain' | 'auth0ClientId'> = {
  supportEmail: 'support@traxionright.com',
  logoLight: TraxionRightLightLogo,
  logoDark: TraxionRightDarkLogo,
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
