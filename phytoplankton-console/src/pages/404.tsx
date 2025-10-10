import { Card, Result } from 'antd';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/library/Button';
import { useBackUrl } from '@/utils/backUrl';

const NoFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const backUrl = useBackUrl();
  return (
    <Card>
      <Result
        status="404"
        title="404"
        subTitle="Sorry, the page you visited does not exist."
        extra={
          <Button
            analyticsName="Back home"
            type="PRIMARY"
            onClick={() => {
              navigate(backUrl ?? '/');
            }}
            style={{ marginLeft: 'auto', marginRight: 'auto' }}
          >
            {backUrl ? 'Back' : 'Back home'}
          </Button>
        }
      />
    </Card>
  );
};

export default NoFoundPage;
