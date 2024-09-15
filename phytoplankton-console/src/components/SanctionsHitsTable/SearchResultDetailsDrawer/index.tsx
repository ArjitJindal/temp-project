import React, { useEffect, useMemo, useState } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import { startCase } from 'lodash';
import DownloadAsPDF from '../../DownloadAsPdf/DownloadAsPDF';
import s from './index.module.less';
import ListingCard from './ListingCard';
import Section from './Section';
import { SanctionsEntity, SanctionsHit, SanctionsHitStatus, SanctionsSource } from '@/apis';
import * as Form from '@/components/ui/Form';
import LinkIcon from '@/components/ui/icons/Remix/system/external-link-line.react.svg';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import { message } from '@/components/library/Message';
import Drawer from '@/components/library/Drawer';
import Button from '@/components/library/Button';
import Tabs from '@/components/library/Tabs';
import FieldValue from '@/components/SanctionsHitsTable/SearchResultDetailsDrawer/FieldValue';
import { P } from '@/components/ui/Typography';
import Portal from '@/components/library/Portal';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import AISummary from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/HistoryItem/HistoryItemBase/AISummary';
import Tag from '@/components/library/Tag';
import { AsyncResource, getOr, isSuccess } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import SanctionsComparison, {
  getComparisonItems,
} from '@/components/SanctionsHitsTable/SearchResultDetailsDrawer/SanctionsComparison';

interface Props {
  hitRes: AsyncResource<SanctionsHit | undefined>;
  searchedAt?: number;
  onClose: () => void;
  newStatus?: SanctionsHitStatus;
  onChangeStatus?: (newStatus: SanctionsHitStatus) => void;
  showNavigation?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
}

export default function SearchResultDetailsDrawer(props: Props) {
  const { hitRes, onClose, newStatus, onChangeStatus, showNavigation, onNext, onPrev } = props;

  const hit = getOr(hitRes, undefined);

  const [pdfRef, setPdfRef] = useState<HTMLDivElement | null>(null);
  const pdfName = hit?.entity?.name;
  const [isDownloading, setDownloading] = useState<boolean>(false);
  const handleDownloadClick = async () => {
    setDownloading(true);
  };
  useEffect(() => {
    async function job() {
      if (isDownloading && pdfRef) {
        try {
          await DownloadAsPDF({ pdfRef, fileName: `${pdfName} Screening Details.pdf` });
        } catch (err) {
          message.fatal(`Unable to complete the download!`, err);
        } finally {
          setDownloading(false);
        }
      }
    }
    job();
  }, [isDownloading, pdfRef, pdfName]);
  const okText = isDownloading ? (
    <>
      <LoadingOutlined className={s.spinner} spin /> Downloading
    </>
  ) : (
    <>
      <DownloadLineIcon className={s.icon} /> Download as PDF
    </>
  );
  return (
    <Drawer
      title={
        <div className={s.title}>
          {pdfName ?? ''}
          {hit?.status === 'OPEN' && <Tag color="purple">Human review</Tag>}
        </div>
      }
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
          {showNavigation && (
            <>
              <Button
                type="SECONDARY"
                onClick={onPrev}
                isDisabled={onPrev == null}
                icon={<ArrowLeftSLineIcon />}
              >
                {'Previous hit'}
              </Button>
              <Button
                type="SECONDARY"
                onClick={onNext}
                isDisabled={onNext == null}
                iconRight={<ArrowRightSLineIcon />}
              >
                {'Next hit'}
              </Button>
            </>
          )}
        </>
      }
      footerRight={
        <>
          <Button isDisabled={!isSuccess(hitRes)} type="PRIMARY" onClick={handleDownloadClick}>
            {okText}
          </Button>
          {onChangeStatus && newStatus && (
            <Button
              isDisabled={!isSuccess(hitRes)}
              type="PRIMARY"
              onClick={() => onChangeStatus(newStatus)}
            >
              {newStatus === 'CLEARED' && 'Clear'}
              {newStatus === 'OPEN' && 'Re-open'}
            </Button>
          )}
        </>
      }
    >
      <AsyncResourceRenderer resource={hitRes}>
        {(hit) =>
          hit != null ? (
            <div className={s.sections}>
              <Content {...props} hit={hit} />
              {isDownloading && (
                <Portal>
                  <div style={{ position: 'fixed', opacity: 0, pointerEvents: 'none' }}>
                    <div ref={setPdfRef}>
                      <Content {...props} pdfMode={true} hit={hit} />
                    </div>
                  </div>
                </Portal>
              )}
            </div>
          ) : (
            <></>
          )
        }
      </AsyncResourceRenderer>
    </Drawer>
  );
}

function Content(props: { hit: SanctionsHit; pdfMode?: boolean; searchedAt?: number }) {
  const { hit, pdfMode = false, searchedAt } = props;
  const comparisonItems = getComparisonItems(
    hit.entity.matchTypeDetails || [],
    hit.hitContext || {},
  );
  return (
    <>
      {hit.status === 'OPEN' && <AISummary text={makeStubAiText(hit)} />}
      {searchedAt && (
        <Section title={'Searched at'}>
          {searchedAt ? <TimestampDisplay timestamp={searchedAt} /> : 'N/A'}
        </Section>
      )}
      {comparisonItems.length > 0 && <SanctionsComparison items={comparisonItems} />}
      {hit.entity && <CAEntityDetails entity={hit.entity} pdfMode={pdfMode} />}
    </>
  );
}

export function CAEntityDetails(props: { entity: SanctionsEntity; pdfMode?: boolean }) {
  const { entity, pdfMode = false } = props;
  const tabItems = useTabs(entity, pdfMode);

  return (
    <>
      <Section title={'Key information'}>
        <div className={s.keyInformation}>
          {!entity.nameMatched && (
            <Form.Layout.Label title={'Full name'}>{entity?.name}</Form.Layout.Label>
          )}
          <Form.Layout.Label title={'Entity type'}>
            {startCase(entity?.entityType)}
          </Form.Layout.Label>
          {entity.aka && (
            <Form.Layout.Label title={'Aliases'}>{entity.aka.join(', ')}</Form.Layout.Label>
          )}
          {entity.dateMatched && entity.yearOfBirth && (
            <Form.Layout.Label key={entity.yearOfBirth} title={'Year of Birth'}>
              {entity.yearOfBirth}
            </Form.Layout.Label>
          )}
          {entity.countries && entity.countries.length > 0 && (
            <Form.Layout.Label key={entity.countries?.join(',')} title={'Country'}>
              {entity.countries?.join(', ')}
            </Form.Layout.Label>
          )}
          {entity.gender && (
            <Form.Layout.Label key={entity.gender} title={'Gender'}>
              {entity.gender}
            </Form.Layout.Label>
          )}
          {entity.associates && entity.associates?.length > 0 && (
            <Form.Layout.Label title={'Other associates'}>
              <div>
                {entity.associates.map(({ association, name }, i) => (
                  <React.Fragment key={i}>
                    {i !== 0 && ', '}
                    <span>
                      {name} ({association})
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </Form.Layout.Label>
          )}
        </div>
      </Section>
      {entity.freetext && (
        <Section title={'Profile notes'}>
          {entity.freetext.split('\n').map((paragraph, index) => (
            <>
              {index !== 0 && <br />}
              {paragraph}
            </>
          ))}
        </Section>
      )}
      {pdfMode ? (
        tabItems.map((item) => <Tabs key={item.key} items={[item]} />)
      ) : (
        <Tabs items={tabItems} />
      )}
    </>
  );
}

/*
  Helpers
 */

function makeStubAiText(hit: SanctionsHit): string {
  const hasNameMatches = hit.entity.matchTypes?.some((x) =>
    [
      'name_exact',
      'aka_exact',
      'name_fuzzy',
      'aka_fuzzy',
      'phonetic_name',
      'phonetic_aka',
      'equivalent_name',
      'equivalent_aka',
      'unknown',
      'removed_personal_title',
      'removed_personal_suffix',
      'removed_organisation_prefix',
      'removed_organisation_suffix',
      'removed_clerical_mark',
      'name_variations_removal',
    ].includes(x),
  );
  const hasDateMatches = hit.entity.matchTypes?.some((x) => ['year_of_birth'].includes(x));
  if (hasNameMatches && hasDateMatches) {
    return 'Date of birth and name match and hit requires human review';
  } else if (hasNameMatches) {
    return 'Name matches and hit requires human review';
  } else if (hasDateMatches) {
    return 'Date of birth match and hit requires human review';
  }
  return 'Hit requires human review';
}

function useTabs(entity: SanctionsEntity, pdfMode) {
  return useMemo(() => {
    const tabs: { name: string; sources: SanctionsSource[] }[] = [
      { name: 'Sources', sources: entity.screeningSources || [] },
      { name: 'Sanctions', sources: entity.sanctionsSources || [] },
      { name: 'PEP', sources: entity.pepSources || [] },
      { name: 'Adverse media', sources: entity.mediaSources || [] },
    ];
    return tabs
      .filter((tab) => tab.sources.length > 0)
      .map((tab) => {
        return {
          key: tab.name,
          title: `${tab.name} (${tab.sources.length})`,
          children: (
            <div className={s.listingItems}>
              {tab.sources.map((source) => {
                const sourceTitle = source?.url ? (
                  <a href={source?.url} target="_blank">
                    {source?.name}
                  </a>
                ) : (
                  source.name
                );

                return (
                  <ListingCard
                    key={source?.name}
                    countries={source.countryCodes || []}
                    title={sourceTitle || ''}
                    listedTime={[source?.createdAt, source?.endedAt]}
                    isExpandedByDefault={pdfMode}
                  >
                    {tab.name === 'Adverse media' ? (
                      <div className={s.adverseMediaList}>
                        {source.media?.map((media) => (
                          <div key={media.title}>
                            <P>
                              <a href={media.url} target="_blank" className={s.link}>
                                <span>{media.title}</span> <LinkIcon height={16} />
                              </a>
                            </P>
                            <P grey={true} variant="xs">
                              {media.snippet}
                            </P>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={s.fieldGrid}>
                        {source.fields?.map((field) => (
                          <React.Fragment key={field.name}>
                            <Form.Layout.Label title={field.name ?? '(Unknown field)'} />
                            <div>
                              {field.values?.map((value) => (
                                <div key={value}>
                                  <FieldValue name={field.name || ''} value={value} />
                                </div>
                              ))}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </ListingCard>
                );
              })}
            </div>
          ),
        };
      });
  }, [
    entity.screeningSources,
    entity.mediaSources,
    entity.pepSources,
    entity.sanctionsSources,
    pdfMode,
  ]);
}
