import React, { useState } from 'react';
import LegalEntityDetails from './LegalEntityDetails';
import Persons from './PersonsCard';
import { InternalBusinessUser } from '@/apis';
import SegmentedControl from '@/components/library/SegmentedControl';

type Tabs = 'LEGAL_ENTITY' | 'SHAREHOLDERS' | 'DIRECTORS';

interface Props {
  user: InternalBusinessUser;
}

export default function BusinessUserDetails(props: Props) {
  const { user } = props;

  const [activeTab, setActiveTab] = useState<Tabs>('LEGAL_ENTITY');

  return (
    <>
      <SegmentedControl<Tabs>
        active={activeTab}
        onChange={setActiveTab}
        items={[
          { label: 'Legal entity', value: 'LEGAL_ENTITY' },
          { label: `Shareholders (${user.shareHolders?.length ?? 0})`, value: 'SHAREHOLDERS' },
          { label: `Directors (${user.directors?.length ?? 0})`, value: 'DIRECTORS' },
        ]}
      />
      {activeTab === 'LEGAL_ENTITY' && <LegalEntityDetails user={user} />}
      {activeTab === 'SHAREHOLDERS' && <Persons persons={user.shareHolders} />}
      {activeTab === 'DIRECTORS' && <Persons persons={user.directors} />}
    </>
  );
}
