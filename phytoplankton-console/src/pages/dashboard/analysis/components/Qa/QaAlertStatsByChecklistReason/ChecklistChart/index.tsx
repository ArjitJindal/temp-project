import { RangeValue } from 'rc-picker/es/interface';
import React, { MutableRefObject, useEffect, useRef, useState } from 'react';
import s from './styles.module.less';
import BarChart, { BarChartData } from '@/components/charts/BarChart';
import { getCsvData } from '@/pages/dashboard/analysis/utils/export-data-build-util';
import Widget from '@/components/library/Widget';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { useQaAlertStatsByChecklistReason } from '@/hooks/api/dashboard';
import { WidgetProps } from '@/components/library/Widget/types';
import { ChecklistTemplate } from '@/apis';
import Select from '@/components/library/Select';
import SegmentedControl from '@/components/library/SegmentedControl';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_15,
} from '@/components/ui/colors';
import NoData from '@/pages/case-management-item/CaseDetails/InsightsCard/components/NoData';
import {
  map,
  isSuccess,
  getOr,
  AsyncResource,
  isFailed,
  isLoading,
  loading,
} from '@/utils/asyncResource';
import Alert from '@/components/library/Alert';

interface Params {
  dateRange: RangeValue<Dayjs>;
  checklistTemplateId?: string;
  checklistCategory?: string;
}

interface ParamsProps extends WidgetProps {
  data: AsyncResource<Array<ChecklistTemplate>>;
}

export const ChecklistChart = (props: ParamsProps) => {
  const { data: templateOptionsRes } = props;

  const [params, setParams] = useState<Params>({
    dateRange: [dayjs().subtract(1, 'month'), dayjs()],
    checklistTemplateId: undefined,
    checklistCategory: undefined,
  });
  const setDateRange = (dateRange: RangeValue<Dayjs>) => {
    setParams((prev) => ({
      ...prev,
      dateRange,
    }));
  };

  const dataToExport = (items) => {
    return items.map((item) => ({
      'Checklist Item Reason': item.checklistItemReason,
      'Total QA Passed Alerts': item.totalQaPassedAlerts,
      'Total QA Failed Alerts': item.totalQaFailedAlerts,
    }));
  };

  const qaAlertStatsByChecklistReason = useQaAlertStatsByChecklistReason({
    dateRange: params.dateRange,
    checklistTemplateId: params.checklistTemplateId,
    checklistCategory: params.checklistCategory,
  });
  const templateOptions = getOr(templateOptionsRes, []);
  const options = templateOptions
    .filter((checklist) => checklist.status === 'ACTIVE')
    .map((checklist, index) => ({
      label: checklist.name,
      value: checklist.id ?? '',
      isDefault: index === 0,
    }));

  useEffect(() => {
    if (templateOptions.length > 0) {
      setParams((prev: Params) => ({
        ...prev,
        checklistTemplateId: templateOptions[0].id,
        checklistCategory: templateOptions[0].categories[0]?.name,
      }));
    }
  }, [templateOptions]);
  const pdfRef = useRef() as MutableRefObject<HTMLInputElement>;
  const donutDataRes = isLoading(templateOptionsRes)
    ? loading<BarChartData>()
    : map(qaAlertStatsByChecklistReason.data, ({ items }): BarChartData => {
        return items.flatMap((item) => {
          return [
            {
              category: item.checklistItemReason ?? '',
              value: item.totalQaPassedAlerts,
              series: 'QA pass',
            },
            {
              category: item.checklistItemReason ?? '',
              value: item.totalQaFailedAlerts,
              series: 'QA fail',
            },
          ];
        });
      });
  return (
    <Widget
      {...props}
      ref={pdfRef}
      resizing="AUTO"
      extraControls={[
        <div className={s.select} key="widget-select">
          <Select
            options={options}
            value={templateOptions.find((item) => item.id === params.checklistTemplateId)?.name}
            onChange={(value) => {
              setParams((prev: Params) => ({
                ...prev,
                checklistTemplateId: value,
                checklistCategory: templateOptions.find((item) => item.id === value)?.categories[0]
                  ?.name,
              }));
            }}
          />
        </div>,
        <DatePicker.RangePicker
          value={params.dateRange}
          onChange={setDateRange}
          key="date-range-pick"
        />,
      ]}
      onDownload={(): Promise<{
        fileName: string;
        data: string;
        pdfRef: MutableRefObject<HTMLInputElement>;
      }> => {
        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `qa-alerts-based-on-checklist-reason-${dayjs().format('YYYY_MM_DD')}`,
            data: getCsvData(dataToExport(getOr(donutDataRes, []))),
            pdfRef: pdfRef,
          };
          resolve(fileData);
        });
      }}
    >
      <div className={s.root}>
        <SegmentedControl<string>
          size="MEDIUM"
          active={params.checklistCategory ?? ''}
          onChange={(newValue) => {
            setParams((prev) => ({
              ...prev,
              checklistCategory: newValue,
            }));
          }}
          items={
            templateOptions
              .find((item) => item.id === params.checklistTemplateId)
              ?.categories.map((category) => ({
                value: category.name,
                label: category.name,
              })) ?? []
          }
        />
        {isSuccess(donutDataRes) && donutDataRes.value.length === 0 ? (
          <NoData />
        ) : isFailed(donutDataRes) ? (
          <Alert type="ERROR">{donutDataRes.message}</Alert>
        ) : (
          <BarChart
            data={isSuccess(donutDataRes) ? donutDataRes : loading<BarChartData>()}
            colors={{
              'QA pass': COLORS_V2_ANALYTICS_CHARTS_01,
              'QA fail': COLORS_V2_ANALYTICS_CHARTS_15,
            }}
            // rotateLabel={false}
            // elipsisLabel={true}
            height={250}
            formatCategory={(val) => {
              return `${val}`.replaceAll("'", '`');
            }}
          />
        )}
      </div>
    </Widget>
  );
};
