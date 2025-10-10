import { isEmpty, isEqual, uniq } from 'lodash';
import { setUserAlias } from '@flagright/lib/utils/userAlias';
import { flattenObject, getFlattenedObjectHumanReadableKey } from '@/utils/json';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import AccountTag from '@/components/AccountTag';
import { AuditLog } from '@/apis/models/AuditLog';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { KYC_STATUSS } from '@/apis/models-custom/KYCStatus';
import { humanizeKYCStatus } from '@/components/utils/humanizeKYCStatus';
import { KYCStatus } from '@/apis/models/KYCStatus';
import { TenantSettings } from '@/apis/models/TenantSettings';
import { USER_STATES } from '@/apis/models-custom/UserState';
import { UserState } from '@/apis/models/UserState';
import { humanizeUserStatus } from '@/components/utils/humanizeUserStatus';

type TableItem = {
  key: string;
  oldImage: object;
  newImage: object;
};
interface TableTemplateProp {
  details: TableItem[];
}

export const summariseChanges = (data: {
  type: string;
  oldImage: object;
  newImage: object;
  showNotChanged?: boolean;
}): {
  changedDetails: TableItem[];
  notChangedDetails: TableItem[];
} => {
  const changedDetails: TableItem[] = [];
  const notChangedDetails: TableItem[] = [];
  const oldImage: object = data?.oldImage && flattenObject(data?.oldImage);
  const newImage: object = data?.newImage && flattenObject(data?.newImage);

  const oldImageKeys = oldImage ? Object.keys(oldImage) : [];
  const newImageKeys = newImage ? Object.keys(newImage) : [];
  const allKeys = uniq([...oldImageKeys, ...newImageKeys]);
  allKeys.forEach((key) => {
    const obj: TableItem = {
      key,
      oldImage: oldImage && oldImage[key] != null ? oldImage[key] : 'N/A',
      newImage: newImage && newImage[key] != null ? newImage[key] : 'N/A',
    };
    if (oldImage && newImage && isEqual(oldImage[key], newImage[key])) {
      notChangedDetails.push(obj);
    } else {
      changedDetails.push(obj);
    }
  });

  return data.showNotChanged
    ? { changedDetails, notChangedDetails }
    : { changedDetails, notChangedDetails: [] };
};

export const summarizeAdvancedOptions = (data: AuditLog) => {
  const flattenedOld = flattenObject(data?.oldImage || {});
  const flattenedNew = flattenObject(data?.newImage || {});
  const allKeys = uniq([...Object.keys(flattenedOld), ...Object.keys(flattenedNew)]);
  return allKeys.map((key) => ({
    key,
    oldImage: flattenedOld[key] || 'N/A',
    newImage: flattenedNew[key] || 'N/A',
  }));
};

const UNIX_TIMESTAMP_MS_REGEX = /^\d{13}$/;
const AUTH0_USER_ID_REGEX = /^(google-oauth2|auth0)\|\S+$/;
const RenderModalData = (value: any | undefined, settings: TenantSettings) => {
  if (typeof value === 'object' && isEmpty(value)) {
    return <em>Empty</em>;
  } else if (typeof value === 'number' && UNIX_TIMESTAMP_MS_REGEX.test(String(value))) {
    return <TimestampDisplay timestamp={value} />;
  } else if (typeof value === 'string' && AUTH0_USER_ID_REGEX.test(value)) {
    return <AccountTag accountId={value} />;
  } else if (Array.isArray(value)) {
    if (value.length && typeof value[0] === 'object') {
      return <pre>{JSON.stringify(value, null, 2)}</pre>;
    } else {
      return <p>{value.join(', ')}</p>;
    }
  } else if (typeof value === 'object') {
    return <pre>{JSON.stringify(value, null, 2)}</pre>;
  } else if (typeof value === 'boolean') {
    return <p>{value ? 'True' : 'False'}</p>;
  } else if (typeof value === 'string' && KYC_STATUSS.includes(value as KYCStatus)) {
    return <p>{humanizeKYCStatus(value as KYCStatus, settings.kycStatusAlias)}</p>;
  } else if (typeof value === 'string' && USER_STATES.includes(value as UserState)) {
    return <p>{humanizeUserStatus(value as UserState, settings.userStateAlias)}</p>;
  } else {
    return <p>{value}</p>;
  }
};

const TableTemplate = (
  props: TableTemplateProp & { showOldImage?: boolean; isMetaData?: boolean },
) => {
  const helper = new ColumnHelper<TableItem>();
  const settings = useSettings();
  return (
    <Table<TableItem>
      rowKey={'key'}
      data={{ items: props.details }}
      pagination={false}
      toolsOptions={false}
      columns={[
        helper.simple<'key'>({
          title: 'Parameter name',
          key: 'key',
          defaultWidth: props.showOldImage ? 250 : 350,
          type: {
            render: (text) => (
              <>
                {text ? (
                  <b>
                    {setUserAlias(getFlattenedObjectHumanReadableKey(text), settings.userAlias)}
                  </b>
                ) : (
                  'N/A'
                )}
              </>
            ),
          },
        }),
        ...(props.showOldImage
          ? [
              helper.simple<'oldImage'>({
                title: 'Old value',
                key: 'oldImage',
                defaultWidth: 350,
                type: {
                  render: (data) => {
                    return RenderModalData(data, settings);
                  },
                },
              }),
            ]
          : []),
        helper.simple<'newImage'>({
          title: props.isMetaData ? 'Value' : 'New value',
          key: 'newImage',
          defaultWidth: 350,
          type: {
            render: (data) => {
              return RenderModalData(data, settings);
            },
          },
        }),
      ]}
    />
  );
};

export default TableTemplate;
