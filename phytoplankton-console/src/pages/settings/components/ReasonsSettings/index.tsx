import React, { useState } from 'react';
import s from './styles.module.less';
import ActionReasonModal from './ActionReasonModal';
import SettingsCard from '@/components/library/SettingsCard';
import { P } from '@/components/ui/Typography';
import Button from '@/components/library/Button';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { ACTION_REASONS } from '@/utils/queries/keys';
import { getOr } from '@/utils/asyncResource';
import { ConsoleActionReason, ConsoleActionReasonCreationRequest, ReasonType } from '@/apis';
import Label from '@/components/library/Label';
import Checkbox from '@/components/library/Checkbox';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';

const REASON_TYPE_LABEL_MAP: { label: string; type: ReasonType }[] = [
  { label: 'Case and alert closure reason', type: 'CLOSURE' },
  { label: 'Escalation reason', type: 'ESCALATION' },
];

export const ReasonsSettings = () => {
  const [createMode, setCreateMode] = useState<ReasonType | undefined>();
  const api = useApi();
  const asyncResourceReasons = useQuery(ACTION_REASONS(), async () => {
    return await api.getActionReasons({});
  });
  const toggleReasonMutation = useMutation(
    async (values: { reasonId: string; isActive: boolean; reasonType: ReasonType }) => {
      const { reasonId, isActive, reasonType } = values;
      return await api.toggleActionReason({
        reasonId,
        ConsoleActionReasonPutRequest: { isActive, reasonType },
      });
    },
    {
      retry: false,
      onSuccess: (actionReason: ConsoleActionReason) => {
        message.success(`Reason ${actionReason.isActive ? 'activated' : 'deactivated'}`);
        asyncResourceReasons.refetch();
      },
      onError: (e) => {
        message.fatal('Failed to toggle reason', e);
      },
    },
  );

  const addReasonsMutation = useMutation(
    async (data: ConsoleActionReasonCreationRequest[]) => {
      return await api.createActionReasons({ ConsoleActionReasonCreationRequest: data });
    },
    {
      retry: false,
      onSuccess: () => {
        message.success('Reasons successfully created');
        asyncResourceReasons.refetch();
        setCreateMode(undefined);
      },
      onError: (e) => {
        message.fatal('Failed to create reasons', e);
      },
    },
  );

  const addReasons = (type: ReasonType, reasons: string[]) => {
    const actionReasons = reasons.map(
      (r): ConsoleActionReasonCreationRequest => ({ reason: r, reasonType: type }),
    );
    addReasonsMutation.mutate(actionReasons);
  };
  const toggleReason = (reasonId: string, isActive: boolean, reasonType: ReasonType) => {
    toggleReasonMutation.mutate({ reasonId, isActive, reasonType });
  };

  const reasons = getOr(asyncResourceReasons.data, []);
  return (
    <SettingsCard
      title="Closure reasons"
      description="Add reasons for closing cases and alerts, and set defaults. Note that any updates will only apply to new, not closed and re-opened cases and alerts."
    >
      <div className={s.root}>
        {REASON_TYPE_LABEL_MAP.map((data, index) => (
          <div className={s.typeColumn} key={index}>
            <div className={s.reasonType} key={data.type}>
              <P bold>{data.label}</P>
              <Button
                type="TEXT"
                size="SMALL"
                onClick={() => {
                  setCreateMode(data.type);
                }}
              >
                Add reason
              </Button>
            </div>
            <div className={s.reasonsContainer}>
              {reasons
                .filter((reasonData) => reasonData.reasonType === data.type)
                .map((reasonData, index) => (
                  <div className={s.checkboxDiv} key={index}>
                    <Label key={index} position="RIGHT" label={reasonData.reason} level={2}>
                      <Checkbox
                        key={index}
                        value={reasonData.isActive}
                        onChange={(newVal) => {
                          if (newVal !== undefined) {
                            toggleReason(reasonData.id, newVal, reasonData.reasonType);
                          }
                        }}
                      />
                    </Label>
                  </div>
                ))}
            </div>
          </div>
        ))}
        <ActionReasonModal
          type={createMode}
          isOpen={!!createMode}
          onClose={() => setCreateMode(undefined)}
          onSubmit={addReasons}
        />
      </div>
    </SettingsCard>
  );
};
