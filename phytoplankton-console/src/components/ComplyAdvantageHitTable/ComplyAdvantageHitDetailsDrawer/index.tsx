import React from 'react';
import { startCase } from 'lodash';
import { SanctionsEntity } from '@/apis';
import Drawer from '@/components/library/Drawer';
import Button from '@/components/library/Button';
import { CAEntityDetails } from '@/components/SanctionsHitsTable/SearchResultDetailsDrawer';

interface Props {
  hit: SanctionsEntity | null;
  searchedAt?: number;
  onClose: () => void;
}

export default function ComplyAdvantageHitDetailsDrawer(props: Props) {
  const { hit, onClose } = props;

  return (
    <Drawer
      title={startCase(hit?.name ?? '')}
      isVisible={Boolean(hit)}
      onChangeVisibility={(isShown) => {
        if (!isShown) {
          onClose();
        }
      }}
      footer={
        <>
          <Button type="SECONDARY" onClick={onClose}>
            {'Close'}
          </Button>
        </>
      }
    >
      {hit && <CAEntityDetails pdfMode={false} entity={hit} delta={hit} />}
    </Drawer>
  );
}
