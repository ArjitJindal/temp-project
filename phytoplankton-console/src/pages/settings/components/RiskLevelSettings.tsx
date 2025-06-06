import React, { useCallback, useMemo, useState } from 'react';
import SettingsCard from '@/components/library/SettingsCard';
import Table from '@/components/library/Table';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { RiskLevel, RiskLevelAlias } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { STRING } from '@/components/library/Table/standardDataTypes';
import Button from '@/components/library/Button';

interface TableItem {
  level: RiskLevel;
  levelAlias: string | undefined;
}

interface ExternalState {
  handleSaveAlias: (level: RiskLevel) => void;
  savingLevel: RiskLevel | null;
  newLevelToAlias: Map<RiskLevel | undefined, string>;
  savedLevelToAlias: Map<RiskLevel | undefined, string>;
}

const helper = new ColumnHelper<TableItem>();

const columns = helper.list([
  helper.simple({
    key: 'level',
    title: 'Level',
    defaultWidth: 100,
  }),
  helper.simple({
    key: 'levelAlias',
    title: 'Alias',
    tooltip:
      'Allows you to add a name that will overwrite the default Risk level displayed in the Console. The Alias name is only used in the Console and will have no impact on the API.',
    type: STRING,
    defaultWidth: 200,
    defaultEditState: true,
  }),
  helper.display({
    title: 'Action',
    enableResizing: false,
    render: (item, context) => {
      const { handleSaveAlias, savingLevel, newLevelToAlias, savedLevelToAlias } =
        context.external as ExternalState;
      return (
        <Button
          type="PRIMARY"
          onClick={() => {
            handleSaveAlias(item.level);
          }}
          isDisabled={
            !!savingLevel ||
            newLevelToAlias.get(item.level) === undefined ||
            (savedLevelToAlias.get(item.level) || '') === (newLevelToAlias.get(item.level) || '')
          }
          isLoading={item.level === savingLevel}
          requiredResources={['write:::settings/risk-scoring/risk-levels-alias/*']}
        >
          Update
        </Button>
      );
    },
  }),
]);

export const RiskLevelSettings: React.FC = () => {
  const settings = useSettings();
  const [savingLevel, setSavingLevel] = useState<RiskLevel | null>(null);
  const levelToAlias = useMemo<Map<RiskLevel | undefined, string>>(
    () => new Map((settings.riskLevelAlias || []).map((entry) => [entry.level, entry.alias])),
    [settings.riskLevelAlias],
  );
  const [commitedLevelToAlias, setCommitedLevelToAlias] = useState<
    Map<RiskLevel | undefined, string>
  >(new Map([...levelToAlias]));
  const savedLevelToAlias = useMemo(
    () => new Map([...levelToAlias, ...commitedLevelToAlias]),
    [levelToAlias, commitedLevelToAlias],
  );
  const [newLevelToAlias, setNewLevelToAlias] = useState<Map<RiskLevel | undefined, string>>(
    new Map([...levelToAlias]),
  );
  const handleUpdateAlias = useCallback(
    (level: RiskLevel, newAlias: string) => {
      setNewLevelToAlias(new Map(newLevelToAlias).set(level, newAlias.trim()));
    },
    [newLevelToAlias],
  );

  const mutateTenantSettings = useUpdateTenantSettings();
  const handleSaveAlias = useCallback(
    async (level: RiskLevel) => {
      setSavingLevel(level);
      try {
        const updatedLevelToAlias = new Map(savedLevelToAlias).set(
          level,
          newLevelToAlias.get(level) || '',
        );
        const riskLevelAlias = Array.from(updatedLevelToAlias.entries())
          .map((entry) => ({
            level: entry[0],
            alias: entry[1],
          }))
          .filter((item) => !!item.alias) as RiskLevelAlias[];
        await mutateTenantSettings.mutateAsync({ riskLevelAlias });
        setCommitedLevelToAlias(updatedLevelToAlias);
      } finally {
        setSavingLevel(null);
      }
    },
    [savedLevelToAlias, newLevelToAlias, mutateTenantSettings],
  );

  const tableData = useMemo<TableItem[]>(
    () => [
      {
        level: 'VERY_HIGH',
        levelAlias: newLevelToAlias.get('VERY_HIGH') ?? '',
      },
      {
        level: 'HIGH',
        levelAlias: newLevelToAlias.get('HIGH') ?? '',
      },
      {
        level: 'MEDIUM',
        levelAlias: newLevelToAlias.get('MEDIUM') ?? '',
      },
      {
        level: 'LOW',
        levelAlias: newLevelToAlias.get('LOW') ?? '',
      },
      {
        level: 'VERY_LOW',
        levelAlias: newLevelToAlias.get('VERY_LOW') ?? '',
      },
    ],
    [newLevelToAlias],
  );

  const externalState: ExternalState = {
    savingLevel,
    newLevelToAlias,
    handleSaveAlias,
    savedLevelToAlias,
  };

  return (
    <SettingsCard
      title="Risk levels alias"
      description="Configure risk levels display name in console."
      minRequiredResources={['read:::settings/risk-scoring/risk-levels-alias/*']}
    >
      <Table<TableItem>
        sizingMode="FULL_WIDTH"
        rowKey="level"
        columns={columns}
        onEdit={(rowKey, newValue) => {
          handleUpdateAlias(rowKey as RiskLevel, newValue.levelAlias ?? '');
        }}
        data={{
          items: tableData,
        }}
        pagination={false}
        toolsOptions={{
          reload: false,
          setting: false,
          download: false,
        }}
        externalState={externalState}
      />
    </SettingsCard>
  );
};
