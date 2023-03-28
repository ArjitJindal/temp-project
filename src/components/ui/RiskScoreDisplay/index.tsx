import React, { useState } from 'react';
import DetailsModal from './DetailsModal';
import MainPanel from './MainPanel';
import { ValueItem } from './types';

interface Props {
  icon: React.ReactNode;
  title: string;
  values: ValueItem[];
}

export default function RiskScoreDisplay(props: Props) {
  const { icon, title, values } = props;
  const [isModalOpen, setModalOpen] = useState(false);
  const lastValue = values.reduce<ValueItem | null>(
    (acc, x) => (acc == null || x.createdAt > acc.createdAt ? x : acc),
    null,
  );
  const components = lastValue?.components;
  return (
    <>
      <MainPanel
        icon={icon}
        title={title}
        values={values}
        onClickInfo={components && components.length > 0 ? () => setModalOpen(true) : undefined}
      />
      <DetailsModal
        icon={icon}
        title={title}
        isOpen={isModalOpen}
        values={values}
        components={components}
        onCancel={() => {
          setModalOpen(false);
        }}
      />
    </>
  );
}
