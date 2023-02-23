import FlagrightLogoSvg from '@/branding/flagright-logo.svg';
import FlagrightDemoLogoSvg from '@/branding/flagright-logo-demo.svg';
import BureauLogoSvg from '@/branding/bureau-logo.svg';

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
}

const DEFAULT_BRANDING: BrandingSettings = {
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
};

const BUREAU_BRANDING: Omit<BrandingSettings, 'auth0Domain' | 'auth0ClientId'> = {
  supportEmail: 'helpdesk@bereau.com',
  logoUrl: BureauLogoSvg,
  demoModeLogoUrl: BureauLogoSvg,
  companyName: 'Bureau',
  notProvisionedWarning: `User does not have a provisioned Bureau Account.`,
  apiDocsLinks: {
    webhooks: 'https://docs.flagright.com/docs/flagright-api/0b0bb2cf007e5-webhooks-overview',
  },
};

export function getBranding(): BrandingSettings {
  if (window.location.hostname.endsWith('tm.bureau.id')) {
    return {
      ...BUREAU_BRANDING,
      auth0Domain: 'bureau-flagright.eu.auth0.com',
      auth0ClientId: 'XFllobU2SratClHKFrSfVSROlpRH8rUm',
    };
  }
  if (window.location.hostname.endsWith('tm.sandbox.bureau.id')) {
    return {
      ...BUREAU_BRANDING,
      auth0Domain: 'sandbox-bureau-flagright.eu.auth0.com',
      auth0ClientId: 'JJHmTg7oupG4tUZRDpvAlghJvvVnbyoc',
    };
  }
  return DEFAULT_BRANDING;
}
