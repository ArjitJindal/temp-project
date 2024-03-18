import FlagrightLightLogo from '@/branding/flagright-logo-light.svg';
import FlagrightDarkLogo from '@/branding/flagright-logo-dark.svg';
import RegtankLightLogo from '@/branding/regtank-logo-light.svg';
import RegtankDarkLogo from '@/branding/regtank-logo-dark.svg';
import ZigramLightLogo from '@/branding/zigram-logo-light.png';
import ZigramDarkLogo from '@/branding/zigram-logo-dark.svg';
import TraxionRightLightLogo from '@/branding/traxionright-logo-light.png';
import TraxionRightDarkLogo from '@/branding/traxion-logo-dark.svg';
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
  env?: 'sandbox' | 'prod';
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
    webhooks: 'https://docs.flagright.com/guides/webhooks/introduction',
  },
  faviconUrl: FlagrightFavicon,
  systemAvatarUrl: FlagrightNoTextLogo,
};

const REGTANK_BRANDING: Omit<BrandingSettings, 'auth0Domain' | 'auth0ClientId'> = {
  // TBD
  supportEmail: 'support@regtank.com',
  logoLight: RegtankLightLogo,
  logoDark: RegtankDarkLogo,
  companyName: 'Regtank',
  notProvisionedWarning: `User does not have a provisioned Regtank Account.`,
  apiDocsLinks: {
    webhooks: 'https://docs.flagright.com/guides/webhooks/introduction',
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
    webhooks: 'https://docs.flagright.com/guides/webhooks/introduction',
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
    webhooks: 'https://docs.flagright.com/guides/webhooks/introduction',
  },
  faviconUrl: TraxionRightFavicon,
  systemAvatarUrl: TraxionRightFavicon,
};

// NOTE: should be synced with build/index.js (WHITE_LABEL_DOMAINS)
export const WHITELABEL_BRANDING: { [key: string]: BrandingSettings } = {
  'sandboxconsole.transactcomply.com': {
    ...ZIGRAM_BRANDING,
    auth0Domain: 'login.sandboxconsole.transactcomply.com',
    auth0ClientId: 'qW5HsNLzyfKoKlG8orZza1EQBUqTxfj6',
    env: 'sandbox',
  },
  'qc-staging.console.regtank.com': {
    ...REGTANK_BRANDING,
    auth0Domain: 'login.qc-staging.console.regtank.com',
    auth0ClientId: 'Nz37vE2YAvMRPAIsqLVXcfACo216CMXE',
    env: 'sandbox',
  },
  'transaction.console.regtank.com': {
    ...REGTANK_BRANDING,
    auth0Domain: 'login.transaction.console.regtank.com',
    auth0ClientId: 'nVwFjIjOIyrzQfLtkUXo7sdxODGuHfvc',
    env: 'prod',
  },
  'sitapp.traxionright.com': {
    ...TRAXIONRIGHT_BRANDING,
    auth0Domain: 'login.sitapp.traxionright.com',
    auth0ClientId: 'wJuiiS6bbcGhSMnqC442RL8HKHfMUI4n',
    env: 'sandbox',
  },
  'app.traxionright.com': {
    ...TRAXIONRIGHT_BRANDING,
    auth0Domain: 'login.app.traxionright.com',
    auth0ClientId: '6k9yUXtYFG9WTjsuEhe4LahCD8Q9W8x6',
    env: 'prod',
  },
};

export function getBranding(): BrandingSettings {
  const whitelabelBranding = WHITELABEL_BRANDING[window.location.hostname];
  return whitelabelBranding ?? FLAGRIGHT_BRANDING;
}

export function isWhiteLabeled(): boolean {
  return getBranding().companyName !== 'Flagright';
}
