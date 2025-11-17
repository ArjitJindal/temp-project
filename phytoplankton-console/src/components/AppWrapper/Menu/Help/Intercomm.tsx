import React, { useEffect } from 'react';
import Intercom, { show } from '@intercom/messenger-js-sdk';
import { useAuth0User } from '@/utils/user-utils';
import { useIntercommToken } from '@/utils/api/auth';
import { isSuccess } from '@/utils/asyncResource';
import { dayjs } from '@/utils/dayjs';

interface IntercomProviderProps {}

const IntercomComponent: React.FC<IntercomProviderProps> = () => {
  const auth0User = useAuth0User();
  const intercomToken = useIntercommToken();

  useEffect(() => {
    const widgetKey = INTERCOM_WIDGET_KEY;
    if (!widgetKey) {
      console.warn('Intercom widget key is not set');
      return;
    }

    if (isSuccess(intercomToken.data)) {
      const userData = {
        userId: auth0User.userId,
        intercom_user_jwt: intercomToken.data.value,
      };

      Intercom({
        app_id: widgetKey,
        ...userData,
        created_at: dayjs().unix(),
      });

      show();
    }
  }, [intercomToken, auth0User.userId]);

  return null;
};

export default IntercomComponent;
