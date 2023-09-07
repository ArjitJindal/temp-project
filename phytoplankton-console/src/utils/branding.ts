import FlagrightLogoSvg from '@/branding/flagright-logo.svg';
import FlagrightDemoLogoSvg from '@/branding/flagright-logo-demo.svg';
import FlagrightNoTextLogo from '@/branding/flagright-no-text.svg';
import BureauLogoSvg from '@/branding/bureau-logo.svg';
import BureauFaviconSvg from '@/branding/bureau-favicon.svg';
import RegtankLogoSvg from '@/branding/regtank-logo.svg';
import RegtankFaviconSvg from '@/branding/regtank-favicon.svg';

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
  faviconUrl: '/favicon.ico',
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
  'qc-staging.api.regtank.com': {
    ...REGTANK_BRANDING,
    auth0Domain: 'login.qc-staging.console.regtank.com',
    // TODO: Fill client ID after deployment
    auth0ClientId: '',
  },
  'qc-live.console.regtank.com': {
    ...REGTANK_BRANDING,
    auth0Domain: 'login.qc-live.console.regtank.com',
    // TODO: Fill client ID after deployment
    auth0ClientId: '',
  },
};

export function getBranding(): BrandingSettings {
  const whitelabelBranding = WHITELABEL_BRANDING[window.location.hostname];
  return whitelabelBranding ?? FLAGRIGHT_BRANDING;
}

export function isWhiteLabeled(): boolean {
  return getBranding().companyName !== 'Flagright';
}
