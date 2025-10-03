import React, { useState } from 'react';
import s from './styles.module.less';
import ActionReasonModal from './ActionReasonModal';
import SettingsCard from '@/components/library/SettingsCard';
import { P } from '@/components/ui/Typography';
import Button from '@/components/library/Button';
import {
  useActionReasons,
  useCreateActionReasons,
  useToggleActionReason,
} from '@/hooks/api/settings';
import { getOr } from '@/utils/asyncResource';
import { ConsoleActionReason, ConsoleActionReasonCreationRequest, ReasonType } from '@/apis';
import Label from '@/components/library/Label';
import Checkbox from '@/components/library/Checkbox';
import { message } from '@/components/library/Message';

const REASON_TYPE_LABEL_MAP: { label: string; type: ReasonType }[] = [
  { label: 'Case, alert and payment reason', type: 'CLOSURE' },
  { label: 'Escalation reason', type: 'ESCALATION' },
];

export const ReasonsSettings = () => {
  const [createMode, setCreateMode] = useState<ReasonType | undefined>();
  const asyncResourceReasons = useActionReasons();
  const toggleReasonMutation = useToggleActionReason({
    retry: false,
    onSuccess: (actionReason: ConsoleActionReason) => {
      message.success(`Reason ${actionReason.isActive ? 'activated' : 'deactivated'} successfully`);
      asyncResourceReasons.refetch();
    },
    onError: (e: any) => {
      message.fatal('Failed to toggle reason', e);
    },
  });

  const addReasonsMutation = useCreateActionReasons({
    retry: false,
    onSuccess: (data: ConsoleActionReason[]) => {
      message.success(
        `${data.length > 1 ? 'New' : 'A new'} case and alert closure reason added successfully`,
      );
      asyncResourceReasons.refetch();
      setCreateMode(undefined);
    },
    onError: (e: any) => {
      message.fatal('Failed to create reasons', e);
    },
  });

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
      minRequiredResources={['read:::settings/case-management/closure-reasons/*']}
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
                requiredResources={['write:::settings/case-management/closure-reasons/*']}
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
