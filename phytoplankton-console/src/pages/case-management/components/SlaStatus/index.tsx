import React from 'react';
import s from './styles.module.less';
import SlaPopover from './SlaPopover';
import { SLAPolicyStatusDetails } from './SlaPolicyDetails';
import { SLAPolicyDetails } from '@/apis/models/SLAPolicyDetails';
import { Case, Alert, Account } from '@/apis';

interface Props {
  slaPolicyDetails?: Array<SLAPolicyDetails>;
  entity: Case | Alert;
  accounts: Account[];
}

function SlaStatus(props: Props) {
  const { slaPolicyDetails, entity, accounts } = props;
  return (
    <div className={s.root}>
      {slaPolicyDetails?.map((slaPolicyDetail, index) => {
        if (slaPolicyDetail.policyStatus) {
          return (
            <SlaPopover
              slaPolicyDetail={slaPolicyDetail as SLAPolicyStatusDetails}
              index={index}
              key={index}
              entity={entity}
              accounts={accounts}
            />
          );
        }
      })}
    </div>
  );
}

export default SlaStatus;
