import {
  BRANDING_CONFIG,
  BrandId,
  BrandingConfigItem,
} from '@flagright/lib/config/config-branding';
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
import { neverThrow } from '@/utils/lang';

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
    webhooks?: string;
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
    webhooks: undefined,
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
    webhooks: undefined,
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
    webhooks: undefined,
  },
  faviconUrl: TraxionRightFavicon,
  systemAvatarUrl: TraxionRightFavicon,
};

function getBrandingSettings(
  brandId: BrandId,
): Omit<BrandingSettings, 'auth0Domain' | 'auth0ClientId'> {
  if (brandId === 'REGTANK') {
    return REGTANK_BRANDING;
  }
  if (brandId === 'ZIGRAM') {
    return ZIGRAM_BRANDING;
  }
  if (brandId === 'TRAXIONRIGHT') {
    return TRAXIONRIGHT_BRANDING;
  }
  throw neverThrow(brandId);
}

export const DOMAIN_BRANDING: { [host: string]: BrandingSettings } = Object.entries(
  BRANDING_CONFIG,
).reduce((acc, x): { [url: string]: BrandingSettings } => {
  const [key, settings] = x as [BrandId, BrandingConfigItem];
  return {
    ...acc,
    ...Object.entries(settings.consoleSettings ?? {}).reduce((acc, [env, consoleSettings]) => {
      if (env !== process.env.ENV_NAME) {
        return acc;
      }
      return {
        ...acc,
        [consoleSettings.host]: {
          ...consoleSettings,
          ...getBrandingSettings(key),
          env,
        },
      };
    }, {}),
  };
}, {});

export function getBranding(): BrandingSettings {
  const whitelabelBranding = DOMAIN_BRANDING[window.location.hostname];
  return whitelabelBranding ?? FLAGRIGHT_BRANDING;
}

export function isWhiteLabeled(): boolean {
  return getBranding().companyName !== 'Flagright';
}
