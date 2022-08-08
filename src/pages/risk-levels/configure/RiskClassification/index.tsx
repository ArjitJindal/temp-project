import React, { useEffect, useState } from 'react';
import { message, Slider } from 'antd';
import { ProColumns } from '@ant-design/pro-table/es/typing';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import {
  AsyncResource,
  failed,
  getOr,
  init,
  isLoading,
  loading,
  success,
  useFinishedSuccessfully,
} from '@/utils/asyncResource';
import RiskLevelTag from '@/components/ui/RiskLevelTag';
import { RISK_LEVEL_LABELS, RISK_LEVELS, RiskLevel } from '@/utils/risk-levels';
import { useApi } from '@/api';
import { RiskClassificationScore } from '@/apis';

interface TableItem {
  key: RiskLevel;
  title: string;
}

type State = number[];
type ApiState = Array<RiskClassificationScore>;

function prepareApiState(state: State): ApiState {
  return RISK_LEVELS.map((riskLevel, index) => ({
    riskLevel,
    lowerBoundRiskScore: state[index - 1] ?? 0,
    upperBoundRiskScore: state[index] ?? 100,
  }));
}

function parseApiState(values: ApiState): State {
  const result = [];
  for (let i = 0; i < RISK_LEVELS.length - 1; i += 1) {
    const level = RISK_LEVELS[i];
    const riskLevelEntry = values.find(({ riskLevel }) => riskLevel === level);
    if (riskLevelEntry == null) {
      throw new Error(`Invalid values: ${JSON.stringify(values)}`);
    }
    result[i] = riskLevelEntry.upperBoundRiskScore;
  }
  return result;
}

const LEVEL_ENTRIES = RISK_LEVELS.map((key) => ({
  key,
  title: RISK_LEVEL_LABELS[key],
})) as TableItem[];

export default function RiskQualification() {
  const api = useApi();
  const [syncRes, setSyncRes] = useState<AsyncResource<State>>(init());
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let isCanceled = false;
    async function fetch() {
      try {
        setSyncRes(loading());
        const response: ApiState = await api.getPulseRiskClassification();
        if (isCanceled) {
          return;
        }
        setSyncRes(success(parseApiState(response)));
      } catch (e) {
        if (isCanceled) {
          return;
        }
        console.error(e);
        message.error('Unable to load risk levels settings!');
        setSyncRes(failed('Unable to load risk levels settings!'));
      }
    }
    fetch();
    return () => {
      isCanceled = true;
    };
  }, [api]);
  const justSynced = useFinishedSuccessfully(syncRes);
  useEffect(() => {
    if (justSynced) {
      setState(getOr(syncRes, null));
    }
  }, [syncRes, justSynced]);

  async function handleSave() {
    if (state == null) {
      return;
    }
    try {
      setSyncRes(loading());
      const result: ApiState = await api.postPulseRiskClassification({
        RiskClassificationScore: prepareApiState(state),
      });
      setSyncRes(success(parseApiState(result)));
      message.success('Settings saved!');
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setSyncRes(failed(error));
      message.error(error);
    }
  }
  const columns: ProColumns<TableItem>[] = [
    {
      title: 'Title',
      width: '200px',
      dataIndex: 'key',
      render: (_, item) => <RiskLevelTag level={item.key} />,
    },
    {
      title: 'Score',
      dataIndex: 'score',
      tip: 'Tip',
      valueType: 'digit',
      width: '100px',
      render: (dom, item, index) => {
        if (state == null) {
          return <></>;
        }

        const start = state[index - 1] ?? 0;
        const end = state[index] ?? 100;
        return (
          <span>
            {start} - {end}
          </span>
        );
      },
    },
    {
      render: (dom, item, index) => {
        if (state == null) {
          return <></>;
        }
        const start = state[index - 1] ?? 0;
        const end = state[index] ?? 100;
        return (
          <Slider
            range={true}
            disabled={isLoading(syncRes)}
            min={0}
            max={100}
            value={[start, end]}
            onChange={([newStart, newEnd]) => {
              setState((state) => {
                if (state == null) {
                  return state;
                }
                return state.map((x, i) => {
                  if (i === index - 1) {
                    return newStart;
                  }
                  if (i < index - 1 && x > newStart) {
                    return newStart;
                  }
                  if (i === index) {
                    return newEnd;
                  }
                  if (i > index && x < newEnd) {
                    return newEnd;
                  }
                  return x;
                });
              });
            }}
          />
        );
      },
    },
  ];

  function handleCancel() {
    setState(getOr(syncRes, null));
  }

  // todo: i18n
  return (
    <Table<TableItem>
      disableStripedColoring={true}
      rowKey="key"
      headerTitle="Classification of Risk"
      search={false}
      columns={columns}
      pagination={false}
      dataSource={LEVEL_ENTRIES}
      toolBarRender={() => [
        <Button type="primary" onClick={handleSave} disabled={isLoading(syncRes)}>
          Save
        </Button>,
        <Button onClick={handleCancel} disabled={isLoading(syncRes)}>
          Cancel
        </Button>,
      ]}
      options={{
        setting: false,
        density: false,
        reload: false,
      }}
    />
  );
}
