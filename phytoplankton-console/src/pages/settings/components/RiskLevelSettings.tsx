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

const helper = new ColumnHelper<TableItem>();

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
    async (level: RiskLevel, aliasOverride?: string) => {
      setSavingLevel(level);
      try {
        const updatedLevelToAlias = new Map(savedLevelToAlias).set(
          level,
          aliasOverride ?? (newLevelToAlias.get(level) || ''),
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

  const columns = useMemo(
    () =>
      helper.list([
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
          render: (item, ctx) => {
            const rowApi = ctx.rowApi;
            const draft = (rowApi?.getDraft?.() as TableItem) ?? item;
            const isBusy = rowApi?.isBusy;
            const isDirty = (draft.levelAlias ?? '') !== (item.levelAlias ?? '');
            return (
              <Button
                type="PRIMARY"
                onClick={() => rowApi?.save?.()}
                isDisabled={!isDirty}
                isLoading={isBusy || item.level === savingLevel}
                requiredResources={['write:::settings/risk-scoring/risk-levels-alias/*']}
              >
                Update
              </Button>
            );
          },
        }),
      ]),
    [savingLevel],
  );

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
        data={{
          items: tableData,
        }}
        rowEditing={{
          mode: 'single',
          onSave: async (rowKey, drafted) => {
            handleUpdateAlias(rowKey as RiskLevel, drafted.levelAlias ?? '');
            await handleSaveAlias(rowKey as RiskLevel, drafted.levelAlias ?? '');
          },
        }}
        pagination={false}
        toolsOptions={{
          reload: false,
          setting: false,
          download: false,
        }}
      />
    </SettingsCard>
  );
};
