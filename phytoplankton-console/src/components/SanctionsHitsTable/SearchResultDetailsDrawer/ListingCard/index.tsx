import React, { useState } from 'react';
import { compact } from 'lodash';
import s from './index.module.less';
import ExpandIcon from '@/components/library/ExpandIcon';
import { Small } from '@/components/ui/Typography';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import ExpandContainer from '@/components/utils/ExpandContainer';
import { CountryFlag } from '@/components/ui/CountryDisplay';
import { CountryCode } from '@/apis';
import UpdatedTag from '@/components/library/Tag/UpdatedTag';

interface Props {
  title: string | JSX.Element;
  countries: CountryCode[];
  listedTime: [number | undefined, number | undefined];
  isExpandedByDefault?: boolean;
  children: React.ReactNode;
  hasUpdates: boolean;
  pdfMode?: boolean;
}

export default function ListingCard(props: Props) {
  const {
    listedTime,
    title,
    countries,
    children,
    isExpandedByDefault = false,
    hasUpdates,
    pdfMode,
  } = props;
  const [isExpanded, setIsExpanded] = useState(isExpandedByDefault);
  const nonEmptyTime = compact(listedTime);
  return (
    <div className={s.root}>
      <div className={s.expandIcon}>
        <ExpandIcon
          isExpanded={isExpanded}
          onClick={() => {
            setIsExpanded((prevState) => !prevState);
          }}
        />
      </div>
      <div className={s.children}>
        <div className={s.title}>
          {countries.length > 0 && (
            <div className={s.countries}>
              {countries.map((code) => (
                <CountryFlag key={code} code={code} svg={!pdfMode} />
              ))}
            </div>
          )}
          {title}
          {hasUpdates && <UpdatedTag />}
        </div>
        {nonEmptyTime.length > 0 && (
          <Small className={s.listedTime}>
            {nonEmptyTime
              .map((timestamp) => dayjs(timestamp).format(DEFAULT_DATE_TIME_FORMAT))
              .join(' - ')}
          </Small>
        )}
        <ExpandContainer isCollapsed={!isExpanded}>{children}</ExpandContainer>
      </div>
    </div>
  );
}
