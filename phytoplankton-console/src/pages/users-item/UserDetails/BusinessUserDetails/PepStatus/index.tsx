import { useEffect, useState } from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import { PEPStatus } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import ExpandIcon from '@/components/library/ExpandIcon';
import ExpandContainer from '@/components/utils/ExpandContainer';
import CountryDisplay from '@/components/ui/CountryDisplay';

interface Props {
  pepStatus?: PEPStatus[];
}

const PepStatusItemDetails = ({ pepStatus }: { pepStatus: PEPStatus }) => {
  return (
    <div className={s.details}>
      <div className={s.detailRow}>
        <span className={s.label}>PEP Status:</span>
        <span className={s.value}>{pepStatus.isPepHit ? 'Yes' : 'No'}</span>
      </div>
      {pepStatus.pepRank && (
        <div className={s.detailRow}>
          <span className={s.label}>PEP Rank:</span>
          <span className={s.value}>{humanizeConstant(pepStatus.pepRank)}</span>
        </div>
      )}
      {pepStatus.pepCountry && (
        <div className={s.detailRow}>
          <span className={s.label}>Country:</span>
          <span className={s.value}>
            <CountryDisplay isoCode={pepStatus.pepCountry} />
          </span>
        </div>
      )}
    </div>
  );
};

export default function PepStatus(props: Props) {
  const { pepStatus } = props;
  const [expandedState, setExpandedState] = useState<boolean[]>([]);

  useEffect(() => {
    setExpandedState(pepStatus?.map(() => false) ?? []);
  }, [pepStatus]);

  const onExpandChange = (index: number) => {
    setExpandedState((prev) => {
      const newState = [...prev];
      newState[index] = !prev[index];
      return newState;
    });
  };

  const getPepStatusTitle = (status: PEPStatus) => {
    const parts: string[] = [];
    parts.push(status.isPepHit ? 'Yes' : 'No');

    if (status.pepCountry) {
      parts.push(status.pepCountry);
    }

    if (status.pepRank) {
      parts.push(`(${humanizeConstant(status.pepRank)})`);
    }

    return parts.join(' ');
  };

  return (
    <EntityPropertiesCard title={`PEP status (${pepStatus?.length ?? 0})`}>
      <div className={s.root}>
        {pepStatus && pepStatus.length > 0 ? (
          pepStatus.map((status, i) => (
            <div className={s.subroot} key={i}>
              <div
                className={s.header}
                onClick={() => {
                  onExpandChange(i);
                }}
              >
                <ExpandIcon isExpanded={expandedState[i]} color="BLACK" />
                <span className={s.title}>{getPepStatusTitle(status)}</span>
              </div>
              <ExpandContainer isCollapsed={!expandedState[i]}>
                <div className={s.body}>
                  <PepStatusItemDetails pepStatus={status} />
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
