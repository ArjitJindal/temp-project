import React, { useContext, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from 'antd';
import { getBranding } from '@/utils/branding';
import Spinner from '@/components/library/Spinner';
import { CluesoContext } from '@/components/AppWrapper/Providers/CluesoTokenProvider';

const branding = getBranding();

export default function () {
  const [params] = useSearchParams();
  const cluesoToken = useContext(CluesoContext);

  useEffect(() => {
    if (cluesoToken.length > 0) {
      const redirectUri = params.get('redirect_uri') || branding.knowledgeBaseUrl;
      window.location.href = `${redirectUri}?token=${cluesoToken}`;
    }
  }, [cluesoToken, params]);
  return (
    <Card>
      <Spinner />
    </Card>
  );
}
