import { useState } from 'react';
import s from './index.module.less';
import PageWrapper from '@/components/PageWrapper';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import Stepper from '@/components/library/Stepper';
import Button from '@/components/library/Button';
import FileUploadStep from '@/pages/transactions-import/FileUploadStep';
import DataMappingStep from '@/pages/transactions-import/DataMappingStep';

export default function TransactionsImport() {
  const [activeStep, setActiveStep] = useState('UPLOAD_FILE');

  return (
    <PageWrapper
      header={
        <div className={s.header}>
          <Breadcrumbs
            items={[
              { title: 'Transactions', to: '/transactions' },
              { title: 'Import CSV', to: '/transactions/import/csv' },
            ]}
          />
          <Stepper
            active={activeStep}
            onChange={setActiveStep}
            steps={[
              { key: 'UPLOAD_FILE', title: 'Upload file' },
              { key: 'DATA_MAPPING', title: 'Data mapping' },
              { key: 'DATA_VALIDATION', title: 'Data validation' },
            ]}
          />
        </div>
      }
      footer={
        <div className={s.footer}>
          <Button type={'TETRIARY'}>Continue</Button>
          <Button type={'TETRIARY'}>Cancel</Button>
        </div>
      }
      enableTopPadding={true}
    >
      {activeStep === 'UPLOAD_FILE' && <FileUploadStep />}
      {activeStep === 'DATA_MAPPING' && <DataMappingStep />}
      {activeStep === 'DATA_VALIDATION' && <b>DATA_VALIDATION</b>}
    </PageWrapper>
  );
}
