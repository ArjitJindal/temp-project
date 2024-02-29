/* eslint-disable @typescript-eslint/no-var-requires */
import { MutableRefObject, useCallback, useMemo, useRef, useState } from 'react';
import { snakeCase } from 'lodash';
import { useLocalStorageState } from 'ahooks';
import { exportDataForBarGraphs } from '../../../utils/export-data-build-util';
import Column, { ColumnData } from '../../charts/Column';
import GranularDatePicker, {
  GranularityValuesType,
  timeframe,
} from '../GranularDatePicker/GranularDatePicker';
import { formatDate } from '../../../utils/date-utils';
import s from './styles.module.less';
import { map } from '@/utils/asyncResource';
import { Dayjs, dayjs } from '@/utils/dayjs';
import Widget from '@/components/library/Widget';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import NoData from '@/pages/case-management-item/CaseDetails/InsightsCard/components/NoData';
import { WidgetProps } from '@/components/library/Widget/types';
import DatePicker from '@/components/ui/DatePicker';
import ContainerRectMeasure from '@/components/utils/ContainerRectMeasure';
import { QueryResult } from '@/utils/queries/types';
import SegmentedControl from '@/components/library/SegmentedControl';
import { humanizeAuto } from '@/utils/humanize';

interface Props<DataType, ValueType extends string, GroupType extends string> extends WidgetProps {
  groups: Array<{
    name: GroupType;
    attributeName: string;
    attributeDataPrefix: string;
    seriesLabel?: string;
  }>;
  groupBy: 'VALUE' | 'TIME';
  valueColors: { [key in ValueType]: string };
  values: ValueType[];
  valueNames?: { [key in ValueType]: string };
  queryResult: QueryResult<DataType[]>;
  timeRange: { startTimestamp: number; endTimestamp: number };
  onTimeRangeChange: (dateRange: { startTimestamp: number; endTimestamp: number }) => void;
  setGranularity?: (granularity: GranularityValuesType) => void;
  showGranularity?: boolean;
}

export default function DistributionChartWidget<
  DataType extends { [key: string]: any },
  ValueType extends string,
  GroupType extends string = string,
>(props: Props<DataType, ValueType, GroupType>) {
  const {
    queryResult,
    groups,
    groupBy,
    valueColors: attributeColors,
    values,
    timeRange,
    onTimeRangeChange,
    valueNames,
    downloadFilenamePrefix,
    setGranularity,
    showGranularity,
    ...restProps
  } = props;
  const dateRange = useMemo<[Dayjs, Dayjs]>(
    () => [dayjs(timeRange.startTimestamp), dayjs(timeRange.endTimestamp)],
    [timeRange.endTimestamp, timeRange.startTimestamp],
  );
  const [selectedGroup, setSelectedGroup] = useLocalStorageState<GroupType>(
    `dashboard-${restProps.id}`,
    groups[0].name,
  );
  const [timeWindowType, setTimeWindowType] = useState<timeframe>('YEAR');
  const preparedDataRes = map(queryResult.data, (data): ColumnData<string, number, ValueType> => {
    const { attributeDataPrefix } = groups.find((group) => group.name === selectedGroup) ?? {};
    if (groupBy === 'TIME') {
      return data.flatMap((dataItem): ColumnData<string, number, ValueType> => {
        return values.map((value) => {
          return {
            xValue: dataItem.time ?? '-',
            yValue: dataItem[`${attributeDataPrefix}_${value}`] ?? 0,
            series: value,
          };
        });
      });
    } else {
      return values.map((attribute) => {
        const count = data.reduce(
          (acc, x) => acc + (x[`${attributeDataPrefix}_${attribute}`] ?? 0),
          0,
        );
        return {
          xValue: attribute,
          yValue: count,
          series: attribute,
        };
      });
    }
  });
  const attributeName = useMemo<string | undefined>(
    () => groups.find((group) => group.name === selectedGroup)?.attributeName,
    [groups, selectedGroup],
  );
  const seriesLabel = useMemo<string>(
    () => groups.find((group) => group.name === selectedGroup)?.seriesLabel ?? '',
    [groups, selectedGroup],
  );
  const pdfRef = useRef() as MutableRefObject<HTMLInputElement>;
  const getValueName = useCallback(
    (value: string) => valueNames?.[value] ?? humanizeAuto(value),
    [valueNames],
  );
  const selectedGroupPrefix = groups.length > 1 ? `-${snakeCase(attributeName)}` : '';

  return (
    <AsyncResourceRenderer resource={preparedDataRes}>
      {(data) => {
        if (data.length === 0) {
          return <NoData />;
        }
        return (
          <Widget
            ref={pdfRef}
            resizing="FIXED"
            {...restProps}
            extraControls={
              setGranularity && showGranularity
                ? [
                    <GranularDatePicker
                      timeWindowType={timeWindowType}
                      setTimeWindowType={setTimeWindowType}
                      setGranularity={setGranularity}
                      dateRange={dateRange}
                      setDateRange={(e) => {
                        onTimeRangeChange({
                          startTimestamp: e?.[0]?.valueOf() ?? 0,
                          endTimestamp: e?.[1]?.valueOf() ?? 0,
                        });
                      }}
                    />,
                  ]
                : [
                    <DatePicker.RangePicker
                      value={dateRange}
                      onChange={(e) => {
                        onTimeRangeChange({
                          startTimestamp: e?.[0]?.valueOf() ?? 0,
                          endTimestamp: e?.[1]?.valueOf() ?? 0,
                        });
                      }}
                    />,
                  ]
            }
            onDownload={(): Promise<{
              fileName: string;
              data: string;
              pdfRef: MutableRefObject<HTMLInputElement>;
            }> => {
              return new Promise((resolve, _reject) => {
                if (attributeName == null) {
                  throw new Error(`Unable to download file, attributeName can not be null`);
                }
                const fileData = {
                  fileName: `${downloadFilenamePrefix}${selectedGroupPrefix}-${dayjs().format(
                    'YYYY_MM_DD',
                  )}`,
                  data: exportDataForBarGraphs(
                    data,
                    attributeName,
                    undefined,
                    groupBy === 'TIME' ? seriesLabel : '',
                  ),
                  pdfRef,
                  tableTitle: `${attributeName} distribution`,
                };
                resolve(fileData);
              });
            }}
          >
            <div className={s.root}>
              {groups.length > 1 ? (
                <SegmentedControl<GroupType>
                  size="MEDIUM"
                  active={selectedGroup}
                  onChange={(newValue) => {
                    setSelectedGroup(newValue);
                  }}
                  items={groups.map((group) => ({ label: group.name, value: group.name }))}
                />
              ) : null}
              <div className={s.chartContainer}>
                <ContainerRectMeasure className={s.chartContainer2}>
                  {(size) => (
                    <Column<ValueType, string>
                      data={data}
                      colors={attributeColors}
                      hideLegend={groupBy === 'VALUE'}
                      height={size.height}
                      rotateLabel={groupBy === 'TIME'}
                      formatSeries={getValueName}
                      formatX={groupBy === 'VALUE' ? getValueName : formatDate}
                    />
                  )}
                </ContainerRectMeasure>
              </div>
            </div>
          </Widget>
        );
      }}
    </AsyncResourceRenderer>
  );
}
