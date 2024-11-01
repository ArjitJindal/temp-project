import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { COUNTRIES } from '@flagright/lib/constants';
import { compact, sortBy } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import { consolidatePEPStatus, expandPEPStatus, validatePEPStatus } from './utils';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import EditIcon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import Modal from '@/components/library/Modal';
import { useApi } from '@/api';
import { CountryCode, PEPStatus, PepRank } from '@/apis';
import Label from '@/components/library/Label';
import Toggle from '@/components/library/Toggle';
import Select from '@/components/library/Select';
import Button from '@/components/library/Button';
import { message } from '@/components/library/Message';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { getErrorMessage } from '@/utils/lang';
import { useHasPermissions } from '@/utils/user-utils';

interface Props {
  userId: string;
  pepStatus: PEPStatus[];
  updatePepStatus: (pepStatus: PEPStatus[]) => void;
}

export type FormValues = {
  isPepHit: boolean;
  pepCountry?: CountryCode[];
  pepRank?: PepRank;
};

interface FormProps {
  values: FormValues;
  onChange: (values: FormValues) => void;
  onDelete: () => void;
}

export const PEP_RANK_OPTIONS: PepRank[] = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'];

export const PepStatusLabel = (props: Props) => {
  const { userId, pepStatus, updatePepStatus } = props;
  const { pepStatusLock } = useSettings();
  const canUpdatePEPStatus = useHasPermissions(['users:user-pep-status:write']);
  const [isOpen, setIsOpen] = useState(false);
  const consolidatedPepStatus = consolidatePEPStatus(pepStatus);
  const DEFAULT_FORM_VALUES: FormValues[] = consolidatedPepStatus.length
    ? consolidatedPepStatus
    : [
        {
          isPepHit: true,
        },
      ];
  const [formValues, setFormValues] = useState<FormValues[]>(DEFAULT_FORM_VALUES);

  const handleChange = (index: number, values: FormValues) => {
    setFormValues((prev) => {
      return prev.map((value, i) => (i === index ? values : value));
    });
  };

  const handleDelete = (index: number) => {
    setFormValues((prev) => {
      return prev.filter((_, i) => i !== index);
    });
  };

  const api = useApi();

  const userUpdateMutation = useMutation(
    [],
    async () => {
      const pepStatusToUpdate = expandPEPStatus(formValues);
      const isValid = validatePEPStatus(pepStatusToUpdate);
      if (!isValid) {
        throw new Error('Conflicting entries found');
      }
      await api.postConsumerUsersUserId({
        userId: userId,
        UserUpdateRequest: {
          pepStatus: pepStatusToUpdate,
        },
      });
      updatePepStatus(pepStatusToUpdate);
    },
    {
      onSuccess: () => {
        setIsOpen(false);
        message.success(
          'PEP Status updated successfully (It might take a few seconds to be visible in Console)',
        );
      },
      onError: (error) => {
        message.fatal(`Unable to update PEP status! ${getErrorMessage(error)}`, error);
      },
    },
  );

  return (
    <div className={s.root}>
      <span>PEP Status</span>
      {!pepStatusLock && canUpdatePEPStatus && (
        <EditIcon className={s.icon} onClick={() => setIsOpen(true)} />
      )}
      <Modal
        isOpen={isOpen}
        onCancel={() => setIsOpen(false)}
        onOk={() => {
          userUpdateMutation.mutate();
        }}
        title="PEP Status"
        width="L"
        maskClosable={false}
        okText="Save"
        okProps={{
          isDisabled: userUpdateMutation.isLoading,
          isLoading: userUpdateMutation.isLoading,
        }}
      >
        <div className={s.formContainer}>
          {formValues.map((values, index) => (
            <PepStatusForm
              key={index}
              values={values}
              onChange={(values) => handleChange(index, values)}
              onDelete={() => handleDelete(index)}
            />
          ))}

          <Button
            className={s.addButton}
            onClick={() => {
              setFormValues((prev) => [
                ...prev,
                {
                  isPepHit: true,
                },
              ]);
            }}
          >
            Add
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export const PepStatusValue = (props: { pepStatus: PEPStatus[] }) => {
  const { pepStatus } = props;
  const groupedByCountry = pepStatus
    .filter((status) => status.isPepHit && status.pepCountry)
    .reduce((acc, { pepCountry, pepRank }) => {
      if (pepCountry && !acc[pepCountry]) {
        acc[pepCountry] = { country: pepCountry, ranks: [] };
      }
      if (pepRank && pepCountry) {
        acc[pepCountry].ranks.push(pepRank);
      }
      return acc;
    }, {});

  const pepCountries: { country: CountryCode; ranks: PepRank[] }[] =
    Object.values(groupedByCountry);
  const isPepHit = pepStatus.some((status) => status.isPepHit);
  const pepRanks = sortBy(
    compact(
      pepStatus
        .filter((status) => status.isPepHit && status.pepRank)
        .map((status) => status.pepRank),
    ),
  );
  return (
    <div>
      {pepCountries.length > 0 ? (
        pepCountries.map(({ country, ranks }) => (
          <div key={country} style={{ display: 'inline' }}>
            <CountryDisplay key={country} isoCode={country} />
            {ranks?.length
              ? `(Rank ${ranks.map((rank) => rank.replace('LEVEL_', '')).join(', ')}),`
              : ''}
          </div>
        ))
      ) : isPepHit ? (
        <span>
          {pepRanks.length > 0
            ? `Rank ${pepRanks.map((rank) => rank.replace('LEVEL_', '')).join(', ')}`
            : 'Hit'}
        </span>
      ) : (
        '-'
      )}
    </div>
  );
};

export const PepStatusForm = (props: FormProps) => {
  const { values, onChange, onDelete } = props;
  const { isPepHit, pepRank, pepCountry } = values;
  return (
    <div className={s.form}>
      <Label label="Is PEP" required>
        <Toggle
          value={isPepHit}
          size="SMALL"
          onChange={(checked) => {
            onChange({
              ...values,
              isPepHit: checked ?? false,
            });
          }}
        />
      </Label>
      <Label
        label="PEP Rank"
        required={{
          value: false,
          showHint: true,
        }}
        hint="Level refers to a PEP's influence and risk based on their position, with higher levels indicating greater authority."
      >
        <Select<PepRank>
          value={pepRank}
          onChange={(value) => {
            onChange({
              ...values,
              pepRank: value,
            });
          }}
          options={PEP_RANK_OPTIONS.map((value) => ({
            label: humanizeAuto(value),
            value,
          }))}
          mode="SINGLE"
        />
      </Label>
      <Label
        label="PEP Country"
        required={{
          value: false,
          showHint: true,
        }}
      >
        <Select<CountryCode>
          value={pepCountry}
          onChange={(value) => {
            onChange({
              ...values,
              pepCountry: value,
            });
          }}
          options={Object.entries(COUNTRIES).map(([key, value]) => ({
            label: value,
            value: key as CountryCode,
          }))}
          mode="MULTIPLE"
          autoTrim
        />
      </Label>
      <Button isDanger onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
};
