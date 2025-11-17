import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from 'antd';
import { getBranding } from '@/utils/branding';
import Spinner from '@/components/library/Spinner';
import { useCluesoToken } from '@/utils/api/auth';
import { isSuccess } from '@/utils/asyncResource';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

const branding = getBranding();

export default function () {
  const [params] = useSearchParams();
  const hasFeatureChatbot = useFeatureEnabled('CHATBOT');
  const cluesoTokenQuery = useCluesoToken(hasFeatureChatbot);
  useEffect(() => {
    if (isSuccess(cluesoTokenQuery.data)) {
      const token = cluesoTokenQuery.data.value ?? '';
      if (token && token.length > 0) {
        const redirectUri = params.get('redirect_uri') || branding.knowledgeBaseUrl;
        window.location.href = `${redirectUri}?token=${token}`;
      }
    }
  }, [cluesoTokenQuery, params]);
  return (
    <Card>
      <Spinner />
    </Card>
  );
}
