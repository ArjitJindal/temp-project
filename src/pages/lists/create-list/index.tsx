import { Card } from 'antd';
import type { FC } from 'react';
import PageWrapper from '@/components/PageWrapper';
import Button from '@/components/ui/Button';
import { useI18n } from '@/locales';

const BasicForm: FC<Record<string, any>> = () => {
  const i18n = useI18n();
  // todo: i18n
  return (
    <PageWrapper
      title={i18n('menu.rules.create-rule')}
      description={'Create a custom list to allow, block or flag events.'}
    >
      <Card bordered={false}>
        <>
          <Button analyticsName="Upload CSV">Upload CSV</Button>
        </>
      </Card>
    </PageWrapper>
  );
};

export default BasicForm;
