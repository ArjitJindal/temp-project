import { FlagrightAuth0User } from '../user-utils';
export type Event =
  | {
      title: 'Table Loaded';
      time: number;
    }
  | {
      title: 'Button Clicked';
      name: string;
    }
  | {
      title: string;
      tenant: string;
      userId: string;
      browserName: string;
      deviceType: string;
      browserVersion: string;
      osName: string;
      mobileModel: string;
      mobileVendor: string;
    };

export interface Analytics {
  identify(userId: string, user: FlagrightAuth0User): void;
  tenant(tenantId: string, traits: { apiHost: string }): void;
  page(
    category: string,
    properties: {
      url: string;
      userEmail: string | null;
      tenant: string;
      browserName: string;
      deviceType: string;
      browserVersion: string;
      osName: string;
      mobileModel: string;
      mobileVendor: string;
    },
  ): void;
  event(event: Event): void;
}
