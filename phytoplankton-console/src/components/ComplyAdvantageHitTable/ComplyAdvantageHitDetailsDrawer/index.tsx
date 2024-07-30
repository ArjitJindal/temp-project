import React from 'react';
import { ComplyAdvantageSearchHit } from '@/apis';
import Drawer from '@/components/library/Drawer';
import Button from '@/components/library/Button';
import { CAEntityDetails } from '@/components/SanctionsHitsTable/SearchResultDetailsDrawer';

interface Props {
  hit: ComplyAdvantageSearchHit | null;
  searchedAt?: number;
  onClose: () => void;
}

export default function ComplyAdvantageHitDetailsDrawer(props: Props) {
  const { hit, onClose } = props;

  return (
    <Drawer
      title={hit?.doc?.name ?? ''}
      isVisible={Boolean(hit)}
      isClickAwayEnabled={true}
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
      {hit && (
        <CAEntityDetails
          nameMatched={false}
          dateMatched={false}
          pdfMode={false}
          caEntity={hit.doc}
        />
      )}
    </Drawer>
  );
}
