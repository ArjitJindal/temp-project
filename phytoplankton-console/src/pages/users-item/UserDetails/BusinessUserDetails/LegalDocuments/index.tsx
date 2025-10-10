import React, { useEffect, useState } from 'react';
import s from './index.module.less';
import LegalDocumentsProps from './LegalDocumentsProps';
import { maskDocumentNumber } from './LegalDocumentsProps/utils';
import ExpandIcon from '@/components/library/ExpandIcon';
import { LegalDocument } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import ExpandContainer from '@/components/utils/ExpandContainer';

interface Props {
  legalDocuments?: LegalDocument[];
}

export default function LegalDocuments(props: Props) {
  const { legalDocuments } = props;
  const [expandedState, setExpandedState] = useState<boolean[]>([]);
  useEffect(() => {
    setExpandedState(legalDocuments?.map(() => false) ?? []);
  }, [legalDocuments]);

  const onExpandChange = (index: number) => {
    setExpandedState((prev) => {
      const newState = [...prev];
      newState[index] = !prev[index];
      return newState;
    });
  };

  return (
    <EntityPropertiesCard title={`Legal documents (${legalDocuments ? legalDocuments.length : 0})`}>
      <div className={s.root}>
        {legalDocuments && legalDocuments.length > 0 ? (
          legalDocuments.map((x, i) => (
            <div className={s.subroot} key={i}>
              <div
                className={s.header}
                onClick={() => {
                  onExpandChange(i);
                }}
              >
                <ExpandIcon isExpanded={expandedState[i]} color="BLACK" />
                {x.documentType}
                <div className={s.documentNumber}>
                  {maskDocumentNumber(x.documentNumber as string)}
                </div>
              </div>
              <ExpandContainer isCollapsed={!expandedState[i]}>
                <div className={s.body}>
                  <LegalDocumentsProps legalDocument={x} />
                </div>
              </ExpandContainer>
            </div>
          ))
        ) : (
          <></>
        )}
      </div>
    </EntityPropertiesCard>
  );
}
