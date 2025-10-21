import React, { useCallback, useMemo, useState } from 'react';
import SettingsCard from '@/components/library/SettingsCard';
import Table from '@/components/library/Table';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { RiskLevel, RiskLevelAlias } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { STRING, BOOLEAN } from '@/components/library/Table/standardDataTypes';
import Button from '@/components/library/Button';
import { RISK_LEVELS } from '@/utils/risk-levels';

interface TableItem {
  level: RiskLevel;
  levelAlias: string;
  isActive: boolean;
}

const helper = new ColumnHelper<TableItem>();

export const RiskLevelSettings: React.FC = () => {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const [savingLevel, setSavingLevel] = useState<RiskLevel | null>(null);

  const levelToAlias = useMemo<Map<RiskLevel, string>>(
    () => new Map((settings.riskLevelAlias || []).map((entry) => [entry.level, entry.alias ?? ''])),
    [settings.riskLevelAlias],
  );

  const levelToActive = useMemo<Map<RiskLevel, boolean>>(
    () =>
      new Map(
        (settings.riskLevelAlias || []).map((entry) => [entry.level, entry.isActive ?? true]),
      ),
    [settings.riskLevelAlias],
  );

  const [committedLevelToAlias, setCommittedLevelToAlias] = useState<Map<RiskLevel, string>>(
    new Map([...levelToAlias]),
  );

  const [committedLevelToActive, setCommittedLevelToActive] = useState<Map<RiskLevel, boolean>>(
    new Map([...levelToActive]),
  );

  const savedLevelToAlias = useMemo(
    () => new Map([...levelToAlias, ...committedLevelToAlias]),
    [levelToAlias, committedLevelToAlias],
  );

  const savedLevelToActive = useMemo(
    () => new Map([...levelToActive, ...committedLevelToActive]),
    [levelToActive, committedLevelToActive],
  );

  const [newLevelToAlias, setNewLevelToAlias] = useState<Map<RiskLevel, string>>(
    new Map([...levelToAlias]),
  );

  const [newLevelToActive, setNewLevelToActive] = useState<Map<RiskLevel, boolean>>(
    new Map([...levelToActive]),
  );

  const handleUpdateAlias = useCallback(
    (level: RiskLevel, newAlias: string) => {
      setNewLevelToAlias(new Map(newLevelToAlias).set(level, newAlias.trim()));
    },
    [newLevelToAlias],
  );

  const handleUpdateActive = useCallback(
    (level: RiskLevel, newActive: boolean) => {
      setNewLevelToActive(new Map(newLevelToActive).set(level, newActive));
    },
    [newLevelToActive],
  );

  const handleSaveRow = useCallback(
    async (level: RiskLevel, aliasOverride?: string, activeOverride?: boolean) => {
      setSavingLevel(level);
      try {
        const updatedLevelToAlias = new Map(savedLevelToAlias).set(
          level,
          aliasOverride ?? (newLevelToAlias.get(level) || ''),
        );

        const updatedLevelToActive = new Map(savedLevelToActive).set(
          level,
          activeOverride ?? newLevelToActive.get(level) ?? true,
        );

        const riskLevelAlias: RiskLevelAlias[] = RISK_LEVELS.map((l) => ({
          level: l,
          alias: updatedLevelToAlias.get(l) ?? '',
          isActive: updatedLevelToActive.get(l) ?? true,
        }));

        await mutateTenantSettings.mutateAsync({ riskLevelAlias });
        setCommittedLevelToAlias(updatedLevelToAlias);
        setCommittedLevelToActive(updatedLevelToActive);
      } finally {
        setSavingLevel(null);
      }
    },
    [
      savedLevelToAlias,
      savedLevelToActive,
      newLevelToAlias,
      newLevelToActive,
      mutateTenantSettings,
    ],
  );

  const tableData = useMemo<TableItem[]>(
    () =>
      RISK_LEVELS.map((level) => ({
        level,
        levelAlias: newLevelToAlias.get(level) ?? '',
        isActive: newLevelToActive.get(level) ?? true,
      })),
    [newLevelToAlias, newLevelToActive],
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
        helper.simple({
          key: 'isActive',
          title: 'Status',
          tooltip: 'Toggle whether this risk level is active in the console.',
          type: BOOLEAN,
          defaultWidth: 140,
          defaultEditState: true,
        }),
        helper.display({
          title: 'Action',
          enableResizing: false,
          render: (item, ctx) => {
            const rowApi = ctx.rowApi;
            const draft = (rowApi?.getDraft?.() as TableItem) ?? item;
            const isBusy = rowApi?.isBusy;
            const hasUnsavedChanges =
              (draft.levelAlias ?? '') !== (item.levelAlias ?? '') ||
              draft.isActive !== item.isActive;
            return (
              <Button
                type="PRIMARY"
                onClick={() => rowApi?.save?.()}
                isDisabled={!hasUnsavedChanges}
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
      description="Configure risk levels display name and active status in console."
      minRequiredResources={['read:::settings/risk-scoring/risk-levels-alias/*']}
    >
      <Table<TableItem>
        sizingMode="FULL_WIDTH"
        rowKey="level"
        columns={columns}
        data={{ items: tableData }}
        rowEditing={{
          mode: 'single',
          onSave: async (rowKey, drafted) => {
            handleUpdateAlias(rowKey as RiskLevel, drafted.levelAlias ?? '');
            handleUpdateActive(rowKey as RiskLevel, drafted.isActive ?? true);
            await handleSaveRow(
              rowKey as RiskLevel,
              drafted.levelAlias ?? '',
              drafted.isActive ?? true,
            );
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
