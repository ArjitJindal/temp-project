import { useState } from 'react';
import s from './index.module.less';
import PageWrapper from '@/components/PageWrapper';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import * as Card from '@/components/ui/Card';
import Stepper from '@/components/library/Stepper';
import Button from '@/components/library/Button';

export default function TransactionsImport() {
  const [activeStep, setActiveStep] = useState('UPLOAD');

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
              { key: 'UPLOAD', title: 'Upload file' },
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
    >
      <Card.Root>
        <Card.Section>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
          <div>
            Transactions Import, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda
            das, asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das,
            asda das, asda das, asda das, asda das, asda das, asda das, asda das, asda das
          </div>
        </Card.Section>
      </Card.Root>
    </PageWrapper>
  );
}
