import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import { compact, difference, groupBy, isEmpty, isEqual, startCase, uniq } from 'lodash';
import {
  capitalizeWordsInternal,
  humanizeAuto,
  humanizeSnakeCase,
} from '@flagright/lib/utils/humanize';
import { COUNTRIES } from '@flagright/lib/constants';
import { COUNTRY_ALIASES } from '@flagright/lib/constants/countries';
import DownloadAsPDF from '../../DownloadAsPdf/DownloadAsPDF';
import s from './index.module.less';
import ListingCard from './ListingCard';
import Section from './Section';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';
import {
  CountryCode,
  GenericSanctionsSearchType,
  SanctionsEntity,
  SanctionsEntityDelta,
  SanctionsEntityType,
  SanctionsHit,
  SanctionsHitStatus,
  SanctionsSource,
} from '@/apis';
import * as Form from '@/components/ui/Form';
import LinkIcon from '@/components/ui/icons/Remix/system/external-link-line.react.svg';
import Popover from '@/components/ui/Popover/AutoHidePopover';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import { message } from '@/components/library/Message';
import Drawer from '@/components/library/Drawer';
import Button from '@/components/library/Button';
import Tabs, { TabItem } from '@/components/library/Tabs';
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
import { CountryFlag } from '@/components/ui/CountryDisplay';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import Tags from '@/pages/users-item/UserDetails/shared/Tags';
import InformationIcon from '@/components/ui/icons/Remix/system/information-fill.react.svg';
import COLORS from '@/components/ui/colors';
import Tooltip from '@/components/library/Tooltip';

interface Props {
  hitRes: AsyncResource<SanctionsHit | undefined>;
  searchedAt?: number;
  onClose: () => void;
  newStatus?: SanctionsHitStatus;
  onChangeStatus?: (newStatus: SanctionsHitStatus) => void;
  showNavigation?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  alertCreatedAt?: number;
}

export default function SearchResultDetailsDrawer(props: Props) {
  const {
    hitRes,
    onClose,
    newStatus,
    onChangeStatus,
    showNavigation,
    onNext,
    onPrev,
    alertCreatedAt,
  } = props;

  const hit = getOr(hitRes, undefined);

  const [pdfRef, setPdfRef] = useState<HTMLDivElement | null>(null);
  const pdfName = capitalizeWordsInternal(hit?.entity?.name ?? '');
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
          {hit?.entity?.profileImagesUrls?.length ? (
            <img height={36} src={hit?.entity?.profileImagesUrls[0]} />
          ) : (
            <></>
          )}
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
            <div className={s.footerNavigation}>
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
            </div>
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
                      <Content
                        {...props}
                        pdfMode={true}
                        hit={hit}
                        alertCreatedAt={alertCreatedAt}
                      />
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

function Content(props: {
  hit: SanctionsHit;
  pdfMode?: boolean;
  searchedAt?: number;
  alertCreatedAt?: number;
}) {
  const { hit, pdfMode = false, searchedAt, alertCreatedAt } = props;
  const comparisonItems = getComparisonItems(
    hit.entity.matchTypeDetails || [],
    hit.hitContext || { entity: 'USER' },
    hit.entity,
  );
  return (
    <>
      {pdfMode ? (
        <div className={s.pdfModeHeader}>
          {alertCreatedAt && (
            <div>Alert created at {dayjs(alertCreatedAt).format(DEFAULT_DATE_TIME_FORMAT)}</div>
          )}{' '}
          <div> Downloaded at {dayjs().format(DEFAULT_DATE_TIME_FORMAT)}</div>
        </div>
      ) : (
        <></>
      )}

      {hit.score != null && (
        <AISummarySection score={hit.score} comment={hit.comment ?? makeStubAiText(hit)} />
      )}
      {(hit.comment || hit.status === 'OPEN') && hit.score == null && (
        <AISummary text={hit.comment ?? makeStubAiText(hit)} />
      )}
      {searchedAt && (
        <Section title={'Searched at'}>
          {searchedAt ? <TimestampDisplay timestamp={searchedAt} /> : 'N/A'}
        </Section>
      )}
      {comparisonItems.length > 0 && <SanctionsComparison items={comparisonItems} />}
      {hit.entity && <CAEntityDetails entity={hit.entity} delta={hit.delta} pdfMode={pdfMode} />}
    </>
  );
}

export function AISummarySection(props: { score: number; comment: string }) {
  const { score, comment } = props;
  return (
    <div className={s.aiScore}>
      <div className={s.aiScoreHeader}>
        <div className={s.aiScoreTitle}>
          <div className={s.icon}>
            <AiForensicsLogo />
          </div>
          AI Score
        </div>
        <div className={s.currentValue}>
          <span>{(score ?? 0.0)?.toFixed(2) ?? 'N/A'}</span>
        </div>
      </div>
      <AISummary text={comment} />
    </div>
  );
}

export function CAEntityDetails(props: {
  entity: SanctionsEntity;
  delta?: SanctionsEntityDelta;
  pdfMode?: boolean;
}) {
  const { entity, delta, pdfMode = false } = props;
  const tabItems = useTabs(entity, pdfMode, delta);
  const occupations = entity?.occupations ?? [];
  const occupationTitles = compact(occupations?.map((occ) => occ.title));
  const occupationCodes = uniq(
    compact(occupations?.map((o) => (o.occupationCode ? humanizeAuto(o.occupationCode) : null))),
  );
  const pepRanks = uniq(compact(occupations?.map((o) => (o.rank ? humanizeAuto(o.rank) : null))));
  const associations = entity.associates?.filter((a) => a.name);
  const countryCodesMap = compact(entity.countries)?.reduce((acc, countryName) => {
    const country = COUNTRIES[countryName as CountryCode];
    let code = country
      ? countryName
      : Object.entries(COUNTRIES).find(([_, name]) => name === countryName)?.[0];

    if (!code) {
      code = Object.entries(COUNTRY_ALIASES).find(([_, aliases]) =>
        aliases?.includes(countryName),
      )?.[0];
    }

    if (code) {
      acc[code] = countryName;
    }
    return acc;
  }, {});
  return (
    <>
      <Section title={'Key information'}>
        <div className={s.keyInformation}>
          {!entity.nameMatched && (
            <Form.Layout.Label title={'Full name'}>
              {capitalizeWordsInternal(entity?.name)}
            </Form.Layout.Label>
          )}
          <Form.Layout.Label title={'Entity type'}>
            {startCase(entity?.entityType?.toLowerCase())}
          </Form.Layout.Label>
          {isEqual(entity.yearOfBirth, entity.dateOfBirths) ? (
            <Form.Layout.Label
              isChangedIcon={delta?.yearOfBirth != null}
              key={entity.yearOfBirth?.[0]}
              title={
                isHitEntityPerson(entity.entityType) ? 'Year of Birth' : 'Year of Incorporation'
              }
            >
              {entity?.yearOfBirth?.length ? entity.yearOfBirth.join(', ') : '-'}
            </Form.Layout.Label>
          ) : (
            <>
              {entity.yearOfBirth && (
                <Form.Layout.Label
                  isChangedIcon={delta?.yearOfBirth != null}
                  key={entity.yearOfBirth[0]}
                  title={
                    isHitEntityPerson(entity.entityType) ? 'Year of Birth' : 'Year of Incorporation'
                  }
                >
                  {(entity?.yearOfBirth?.length ?? 0) > 0 ? entity.yearOfBirth.join(', ') : '-'}
                </Form.Layout.Label>
              )}
              {(entity.dateOfBirths?.length ?? 0) > 0 &&
                entity.yearOfBirth &&
                difference(entity.dateOfBirths, entity.yearOfBirth).length > 0 && (
                  <Form.Layout.Label
                    title={
                      isHitEntityPerson(entity.entityType)
                        ? 'Date of birth'
                        : 'Date of incorporation'
                    }
                    isChangedIcon={delta?.yearOfBirth != null}
                  >
                    {difference(entity.dateOfBirths, entity.yearOfBirth).join(', ')}
                  </Form.Layout.Label>
                )}
            </>
          )}
          {entity.countries && entity.countries.length > 0 && (
            <Form.Layout.Label
              key={entity.countries?.join(',')}
              title={'Country'}
              isChangedIcon={delta?.nationality != null}
            >
              <div className={s.countryList}>
                {Object.entries(countryCodesMap).map(([code, countryName], i) => (
                  <div key={i}>
                    <CountryFlag key={code} code={code as CountryCode} svg={!pdfMode} />{' '}
                    <span>{countryName}</span>
                    {i < Object.entries(countryCodesMap).length - 1 && ', '}{' '}
                  </div>
                ))}
              </div>
            </Form.Layout.Label>
          )}
          {entity.nationality && entity.nationality.length > 0 && (
            <Form.Layout.Label
              key={entity.nationality?.join(',')}
              title={isHitEntityPerson(entity.entityType) ? 'Nationality' : 'Countries'}
              isChangedIcon={delta?.nationality != null}
            >
              {compact(entity.nationality?.map((code) => COUNTRIES[code])).length > 0
                ? compact(entity.nationality?.map((code) => COUNTRIES[code])).join(', ')
                : 'Not known'}
            </Form.Layout.Label>
          )}
          {occupationTitles.length > 0 && (
            <Form.Layout.Label key={occupationTitles.join(',')} title={'Occupation'}>
              {occupations
                .filter((o) => o.title)
                .map(
                  (occ) =>
                    `${occ.title} ${
                      occ.dateFrom || occ.dateTo
                        ? `(${occ.dateFrom || 'Unknown'} - ${occ.dateTo || 'Unknown'})`
                        : ''
                    }`,
                )
                .join(', ')}
            </Form.Layout.Label>
          )}
          {isHitEntityPerson(entity.entityType) ? (
            <Form.Layout.Label
              key={entity.gender}
              title={'Gender'}
              isChangedIcon={delta?.gender != null}
            >
              {entity.gender ?? '-'}
            </Form.Layout.Label>
          ) : (
            <></>
          )}
          {entity.aka && entity.aka?.length > 0 && (
            <Form.Layout.Label title={'Aliases'}>
              <div className={s.aliases}>
                {entity.aka.map((aka, i) => (
                  <Popover
                    key={i}
                    content={capitalizeWordsInternal(aka)}
                    trigger="hover"
                    children={<Tag color="gray">{capitalizeWordsInternal(aka)}</Tag>}
                    wrapText={true}
                  />
                ))}
              </div>
            </Form.Layout.Label>
          )}
          {associations && associations.length > 0 && (
            <Form.Layout.Label title={'Other associates'}>
              <div>
                {pdfMode ? (
                  associations.map(({ association, name, ranks, sanctionsSearchTypes }, i) => (
                    <React.Fragment key={i}>
                      {i !== 0 && ', '}
                      <span>
                        {name} ({association}
                        {ranks && ranks.length > 0
                          ? ` , PEP ranks: ${uniq(ranks)
                              .map((r) => humanizeSnakeCase(r))
                              .join(', ')})`
                          : ''}
                        {sanctionsSearchTypes?.length
                          ? `, Screening types: ${sanctionsSearchTypes
                              .map((type) => humanizeSnakeCase(type))
                              .join(', ')}`
                          : ''}
                        )
                      </span>
                    </React.Fragment>
                  ))
                ) : (
                  <div className={s.tags}>
                    {associations.map((assoc, i) => (
                      <Tag color="gray" key={i} wrapText={false} trimText={false}>
                        <div className={s.associateInfo}>
                          <span>{assoc.name}</span>
                          {assoc.association ||
                          assoc.sanctionsSearchTypes?.length ||
                          assoc.ranks?.length ? (
                            <Tooltip
                              title={
                                <div className={s.associateInfoTooltip}>
                                  {getAssociationRow('Association', assoc.association)}
                                  {getAssociationRow(
                                    'Screening types',
                                    assoc.sanctionsSearchTypes
                                      ?.map((type) => humanizeSnakeCase(type))
                                      .join(', '),
                                  )}
                                  {getAssociationRow(
                                    'PEP rank',
                                    assoc.ranks?.map((r) => humanizeSnakeCase(r)).join(', '),
                                  )}
                                </div>
                              }
                            >
                              <InformationIcon
                                height={14}
                                cursor="pointer"
                                color={COLORS.brandBlue.base}
                              />
                            </Tooltip>
                          ) : (
                            <></>
                          )}
                        </div>
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            </Form.Layout.Label>
          )}
          {pepRanks.length > 0 && (
            <Form.Layout.Label title={'PEP Level'}>{pepRanks.join(', ')}</Form.Layout.Label>
          )}
          {occupationCodes.length > 0 && (
            <Form.Layout.Label title={'Occupation categories'}>
              {occupationCodes.join(', ')}
            </Form.Layout.Label>
          )}
          {entity.sanctionSearchTypes?.includes('PEP') && entity.isActivePep != null && (
            <Form.Layout.Label title={'PEP status'}>
              {entity.isActivePep === true ? 'Active' : 'Inactive'}
            </Form.Layout.Label>
          )}
          {entity.sanctionSearchTypes?.includes('SANCTIONS') &&
            entity.isActiveSanctioned != null && (
              <Form.Layout.Label title={'Sanctioned status'}>
                {entity.isActiveSanctioned === true ? 'Active' : 'Inactive'}
              </Form.Layout.Label>
            )}
          {entity.isDeseased && (
            <Form.Layout.Label title={'Deseased'}>
              {entity.isDeseased ? 'Yes' : 'No'}
            </Form.Layout.Label>
          )}
          {entity.documents && entity.documents.length > 0 && (
            <Form.Layout.Label title={'Documents'}>
              <div className={s.documents}>
                {Object.entries(
                  groupBy(
                    entity.documents.filter((doc) => doc.id),
                    'name',
                  ),
                ).map(([name, docs], i) => (
                  <div key={i}>
                    <span>{`${name}: `}</span>
                    <span>{docs.map((doc) => doc.id).join(', ')}</span>
                  </div>
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
      {entity.keywords && entity.keywords?.length > 0 && (
        <Section title={'Keywords'}>{entity.keywords.join(', ')}</Section>
      )}
      {entity.tags && entity.tags?.length > 0 && (
        <Section title={'Additional information'}>
          <Tags tags={entity.tags} hideTitle={true} />
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
  const shouldShowDateMatch = hasDateMatches || isHitEntityPerson(hit.entity.entityType);
  if (hasNameMatches && shouldShowDateMatch) {
    return 'Date of birth and name match and hit requires human review';
  } else if (hasNameMatches) {
    return 'Name matches and hit requires human review';
  } else if (shouldShowDateMatch) {
    return 'Date of birth match and hit requires human review';
  }
  return 'Hit requires human review';
}

// todo: delete when have information in sanction hit
const TMP_TABS_HAS_UPDATES = false;

function useTabs(
  entity: SanctionsEntity,
  pdfMode: boolean,
  delta?: SanctionsEntityDelta,
): TabItem[] {
  return useMemo(() => {
    const tabs: {
      name: string;
      hasUpdates: boolean;
      sources: SanctionsSource[];
      delta?: SanctionsSource[];
    }[] = [
      { name: 'Sources', hasUpdates: TMP_TABS_HAS_UPDATES, sources: entity.screeningSources || [] },
      {
        name: 'Sanctions',
        hasUpdates: TMP_TABS_HAS_UPDATES || !!delta?.sanctionsSources?.length,
        sources: entity.sanctionsSources || [],
        delta: delta?.sanctionsSources,
      },
      {
        name: 'PEP',
        hasUpdates: TMP_TABS_HAS_UPDATES || !!delta?.pepSources?.length,
        sources: entity.pepSources || [],
        delta: delta?.pepSources,
      },
      {
        name: 'Adverse media',
        hasUpdates: TMP_TABS_HAS_UPDATES || !!delta?.mediaSources?.length,
        sources: entity.mediaSources || [],
        delta: delta?.mediaSources,
      },
      {
        name: 'Images',
        hasUpdates: TMP_TABS_HAS_UPDATES,
        sources:
          entity.profileImagesUrls?.map((url) => ({
            name: url,
            url: url,
          })) || [],
      },
      ...(entity.otherSources?.length
        ? entity.otherSources
            .filter((source) => source.value)
            .map((source) => ({
              name: humanizeAuto(source.type as string),
              hasUpdates: TMP_TABS_HAS_UPDATES,
              sources: source.value as SanctionsSource[],
            }))
        : []),
    ];

    return tabs
      .filter((tab) => {
        const searchType = tab.name
          .toUpperCase()
          .replace(/\s+/g, '_') as GenericSanctionsSearchType;
        return (
          (tab.name === 'Sources' && tab.sources.length > 0) ||
          (tab.name === 'Images' && tab.sources.length > 0) ||
          (tab.sources.length > 0 && entity.sanctionSearchTypes?.includes(searchType))
        );
      })
      .map((tab) => {
        return {
          key: tab.name,
          title: `${tab.name} (${tab.sources.length})`,
          showBadge: tab.hasUpdates,
          children: (
            <div className={s.listingItems}>
              {tab.sources.map((source, i) => {
                const sourceTitle = source?.url ? (
                  <a href={source?.url} target="_blank">
                    {source?.name}
                  </a>
                ) : (
                  source.name
                );

                return (
                  <ListingCard
                    pdfMode={pdfMode}
                    key={source?.name}
                    countries={source.countryCodes || []}
                    title={sourceTitle || ''}
                    description={source?.description}
                    listedTime={[source?.createdAt, source?.endedAt]}
                    isExpandedByDefault={pdfMode}
                    /* Just for demo mode we are showing updates for the first source of each tab */
                    hasUpdates={TMP_TABS_HAS_UPDATES || (!isEmpty(tab.delta) && i === 0)}
                    resourceId={entity.resourceId}
                    evidenceId={source.evidenceId}
                    entityType={entity.entityType}
                    sanctionsSourceFields={source.fields}
                  >
                    {tab.name === 'Adverse media' ? (
                      <div className={s.adverseMediaList}>
                        {source.media?.map((media) => (
                          <div key={media.title}>
                            {source.name !== media.title && (
                              <P>
                                <a href={media.url} target="_blank" className={s.link}>
                                  <span>{media.title}</span> <LinkIcon height={16} />
                                </a>
                              </P>
                            )}
                            <P grey={true} variant="xs">
                              {media.snippet}
                            </P>
                          </div>
                        ))}
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
                      </div>
                    ) : (
                      <div className={s.fieldGrid}>
                        {source.fields
                          ?.filter((field) => field.name !== 'Asset url')
                          .map((field) => (
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
    entity.otherSources,
    entity.sanctionSearchTypes,
    entity.profileImagesUrls,
    delta?.mediaSources,
    delta?.pepSources,
    delta?.sanctionsSources,
    entity.resourceId,
    entity.entityType,
  ]);
}

function isHitEntityPerson(entityType: SanctionsEntityType): boolean {
  return entityType.toUpperCase() === 'PERSON';
}

function getAssociationRow(title: string, info?: string): ReactNode {
  if (!info) {
    return <></>;
  }
  return (
    <>
      <span>{title} </span> <span>{info}</span>
    </>
  );
}
