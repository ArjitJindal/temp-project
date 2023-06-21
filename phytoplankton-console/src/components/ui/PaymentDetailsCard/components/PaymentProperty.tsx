import { EllipsisOutlined } from '@ant-design/icons';
import CountryDisplay from '../../CountryDisplay';
import { BooleanDisplay } from '../../BooleanDisplay';
import { CardBrandDisplay } from '../../CardBrandDisplay';
import * as Form from '@/components/ui/Form';
import COUNTRIES from '@/utils/countries';
import { humanizeCamelCase } from '@/utils/humanize';

export function Property(props: { name: string[]; value: unknown }) {
  const { name, value } = props;

  const humanizedName = name.map(humanizeCamelCase).join(' / ');
  if (value != null) {
    if (Array.isArray(value)) {
      return (
        <div style={{ marginTop: '15px' }}>
          <Form.Layout.Label title={humanizedName}>{value.join(', ')}</Form.Layout.Label>
        </div>
      );
    } else if (typeof value === 'object') {
      return (
        <>
          {Object.entries(value).map(([entryKey, entryValue]) => (
            <Property key={entryKey} name={[...name, entryKey]} value={entryValue} />
          ))}
        </>
      );
    }
  }
  if (typeof value === 'boolean') {
    return (
      <>
        <Form.Layout.Label title={humanizedName}>
          <BooleanDisplay value={value} />
        </Form.Layout.Label>
      </>
    );
  }
  if (typeof value === 'string' && Object.keys(COUNTRIES).includes(value)) {
    return (
      <>
        <Form.Layout.Label title={humanizedName}>
          <CountryDisplay isoCode={value} />
        </Form.Layout.Label>
      </>
    );
  }
  if (typeof value === 'string' && name.includes('cardLast4Digits')) {
    return (
      <>
        <Form.Layout.Label title={humanizedName}>
          <span style={{ display: 'flex' }}>
            <span style={{ marginLeft: '4px' }}>
              <EllipsisOutlined
                width="20px"
                height="20px"
                style={{ width: '20px', height: '20px' }}
              />
            </span>
            {value}
          </span>
        </Form.Layout.Label>
      </>
    );
  }
  if (typeof value === 'string' && name.includes('cardBrand')) {
    return (
      <>
        <Form.Layout.Label title={humanizedName}>
          <CardBrandDisplay value={value} />
        </Form.Layout.Label>
      </>
    );
  }

  return (
    <>
      <Form.Layout.Label title={humanizedName}>{`${value}`}</Form.Layout.Label>
    </>
  );
}
