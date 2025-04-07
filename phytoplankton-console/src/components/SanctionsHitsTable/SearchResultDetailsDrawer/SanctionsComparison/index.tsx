import React from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { startCase } from 'lodash';
import s from './index.module.less';
import { SanctionsComparisonTableItem } from '@/components/SanctionsHitsTable/SearchResultDetailsDrawer/SanctionsComparison/types';
import Tag from '@/components/library/Tag';
import Tooltip from '@/components/library/Tooltip';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';

interface Props {
  items: SanctionsComparisonTableItem[];
}

export default function SanctionsComparison(props: Props) {
  const { items } = props;

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div>Screening details</div>
        <div>KYC details</div>
      </div>
      <div className={s.props}>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            <div className={s.propName}>
              {item.title}{' '}
              <Tooltip title={`Sources: ${item.sources.join(', ')}`} trigger="click">
                <InformationLineIcon className={s.tooltipIcon} />
              </Tooltip>
            </div>
            <div className={s.propHitValue}>{startCase(String(item.screeningValue))}</div>
            <div className={s.propHitMatch}>
              <MatchTag match={item.match} />
            </div>
            <div className={s.propValue}>{startCase(String(item.kycValue))}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function MatchTag(props: { match: SanctionsComparisonTableItem['match'] }) {
  const { match } = props;
  const text = humanizeConstant(match);
  switch (match) {
    case 'NO_HIT':
      return <Tag color="green">{text}</Tag>;
    case 'TRUE_HIT':
      return <Tag color="red">{text}</Tag>;
    case 'POTENTIAL_HIT':
      return <Tag color="orange">{text}</Tag>;
  }
}
export { getComparisonItems } from '@/components/SanctionsHitsTable/SearchResultDetailsDrawer/SanctionsComparison/helpers';
