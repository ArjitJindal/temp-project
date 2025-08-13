import { humanizeAuto, humanizeConstant } from '@flagright/lib/utils/humanize';
import { COUNTRIES } from '@flagright/lib/constants';
import s from './index.module.less';
import { CountryCode, PEPStatus, PepRank } from '@/apis';
import CountryDisplay from '@/components/ui/CountryDisplay';
import Label from '@/components/library/Label';
import Select from '@/components/library/Select';
import Button from '@/components/library/Button';
import DeleteIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';

export type PepFormValues = {
  isPepHit: boolean;
  pepCountry?: CountryCode[];
  pepRank?: PepRank;
};

export const PEP_RANK_OPTIONS: PepRank[] = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'];

export const PepStatusValue = (props: { pepStatus: PEPStatus[] }) => {
  const { pepStatus } = props;

  return (
    <div className={s.pepStatus}>
      {pepStatus.map((status) => (
        <div key={`${status.isPepHit}-${status.pepCountry}`} className={s.pepStatusItem}>
          <span>
            {status.isPepHit ? 'Yes' : 'No'}
            {status.pepCountry ? <>{',\xa0'}</> : ''}
          </span>

          {status.pepCountry && (
            <span>
              <CountryDisplay isoCode={status.pepCountry} />
            </span>
          )}
          {status.pepRank && <span>({humanizeConstant(status.pepRank)})</span>}
        </div>
      ))}
    </div>
  );
};

interface PepFormProps {
  values: PepFormValues;
  onChange: (values: PepFormValues) => void;
  onDelete: () => void;
  addNewPepField: () => void;
  isAddForm: boolean;
  showDeleteIcon: boolean;
  labelClassName: string;
}

export const PepStatusForm = (props: PepFormProps) => {
  const { values, onChange, onDelete, isAddForm, addNewPepField, labelClassName, showDeleteIcon } =
    props;
  const { isPepHit, pepRank, pepCountry } = values;
  const isDisabled = !isPepHit;
  return (
    <div className={s.pepform}>
      <Label label="Pep Status" labelClassName={s.flexGrowHalf}>
        <Select<string>
          value={isPepHit ? 'Yes' : 'No'}
          onChange={(value) => {
            onChange({ ...values, isPepHit: value === 'Yes' ? true : false });
          }}
          options={[
            { label: 'Yes', value: 'Yes' },
            { label: 'No', value: 'No' },
          ]}
        />
      </Label>
      <Label
        label="PEP Rank"
        required={{ value: false, showHint: false }}
        hint="Level refers to a PEP's influence and risk based on their position, with higher levels indicating greater authority."
      >
        <Select<PepRank>
          value={pepRank}
          onChange={(value) => {
            onChange({ ...values, pepRank: value });
          }}
          options={PEP_RANK_OPTIONS.map((value) => ({
            label: humanizeAuto(value),
            value,
          }))}
          mode="SINGLE"
          isDisabled={isDisabled}
        />
      </Label>
      <Label
        label="PEP Country"
        required={{ value: false, showHint: false }}
        labelClassName={labelClassName}
      >
        <Select<CountryCode>
          value={pepCountry}
          onChange={(value) => {
            onChange({ ...values, pepCountry: value });
          }}
          options={Object.entries(COUNTRIES).map(([key, value]) => ({
            label: value,
            value: key as CountryCode,
          }))}
          mode="TAGS"
          isDisabled={isDisabled}
        />
      </Label>
      {isAddForm && (
        <Label
          label=""
          required={{ value: false, showHint: false }}
          labelClassName={s.flexGrowQuater}
        >
          <Button onClick={addNewPepField}>Add</Button>
        </Label>
      )}
      {!isAddForm && (
        <Label
          label=""
          required={{ value: false, showHint: false }}
          labelClassName={s.flexGrowQuater}
        >
          {showDeleteIcon ? (
            <div className={s.iconButton}>
              <DeleteIcon onClick={onDelete} height={'1rem'} width={'1rem'} />
            </div>
          ) : (
            <Button type={'DANGER'} onClick={onDelete}>
              Delete
            </Button>
          )}
        </Label>
      )}
    </div>
  );
};
