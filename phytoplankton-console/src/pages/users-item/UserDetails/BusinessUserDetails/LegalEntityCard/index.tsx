import React from 'react';
import LegalEntityDetails from './LegalEntityDetails';
import s from './index.module.less';
import { LegalEntity } from '@/apis';

interface Props {
  legalEntities?: LegalEntity[];
}

export default function LegalEntityCard(props: Props) {
  const { legalEntities } = props;

  return (
    <div className={s.root}>
      {legalEntities?.map((legalEntity) => (
        <LegalEntityDetails
          key={legalEntity.companyGeneralDetails?.legalName}
          legalEntity={legalEntity}
        />
      ))}
    </div>
  );
}
