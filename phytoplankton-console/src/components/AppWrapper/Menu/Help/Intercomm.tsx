import React, { useEffect, useState } from 'react';
import Intercom from '@intercom/messenger-js-sdk';
import { useAuth0User } from '@/utils/user-utils';

interface IntercomProviderProps {}

const IntercomComponent: React.FC<IntercomProviderProps> = (props) => {
  const auth0User = useAuth0User();
  const [isWidgetInitialized, setWidgetInitialization] = useState(false);
  useEffect(() => {
    const widgetKey = INTERCOM_WIDGET_KEY;
    if (!widgetKey) {
      console.warn('Intercom widget key is not set');
      return;
    }

    if (!isWidgetInitialized) {
      const userData = {
        userId: auth0User.userId,
        name: auth0User.name ?? undefined,
        email: auth0User.verifiedEmail ?? undefined,
        tenantId: auth0User.tenantId,
        company: auth0User.tenantId,
      };

      Intercom({
        app_id: widgetKey,
        ...userData,
      });

      setWidgetInitialization(true);
    }
  }, [isWidgetInitialized, auth0User, props]);

  return null;
};

export default IntercomComponent;
