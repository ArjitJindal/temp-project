import FlagrightLogoSvg from '@/branding/flagright-logo.svg';
import FlagrightDemoLogoSvg from '@/branding/flagright-logo-demo.svg';
import BureauLogoSvg from '@/branding/bureau-logo.svg';

interface BrandingSettings {
  apiBasePath?: string;
  auth0ClientId?: string;
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

const BUREAU_BRANDING: BrandingSettings = {
  auth0ClientId: 'PlG7CuQne48LdsZQOXhL0VbPkH2J9vUu',
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
    return BUREAU_BRANDING;
  }
  if (window.location.hostname.endsWith('tm.sandbox.bureau.id')) {
    return {
      ...BUREAU_BRANDING,
      auth0ClientId: '48FYDRh3BJIqwzq4dJDObpLYxTZpIBuR',
    };
  }
  if (window.location.hostname.endsWith('bereau.flagright.com')) {
    return {
      ...BUREAU_BRANDING,
      auth0ClientId: 'Rv2WwX2ZxZRuQ5w6ZC2M2RjkskLxV6hc',
    };
  }
  return DEFAULT_BRANDING;
}
