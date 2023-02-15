import React from 'react';
import { AccountRole, Permission, Permissions } from '@/apis';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { PERMISSIONS_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import PermissionTable from '@/pages/accounts/Roles/PermissionTable';
import { PERMISSIONS } from '@/apis/models-custom/Permission';
import { PermissionRow } from '@/pages/accounts/Roles/types';

export default function Role({ role }: { role: AccountRole }) {
  const api = useApi();
  const { id = '', name = '' } = role;
  const permissionsResp = useQuery<Permissions>(PERMISSIONS_LIST(id), async () => {
    return await api.getPermissions({ roleId: id });
  });
  return (
    <AsyncResourceRenderer resource={permissionsResp.data}>
      {(permissionsResp) => (
        <PermissionTable role={name} items={permissionsToRows(permissionsResp.permissions || [])} />
      )}
    </AsyncResourceRenderer>
  );
}

/** Initialises the following structure:
 *  case-management:case-overview:read
 *  case-management:case-overview:write
 *  case-management:case-details:read
 *
 *  becomes
 *
 *  case-management:
 *     case-overview
 *        read: false
 *        write: false
 *     case-details
 *        read: true
 **/
function permissionsToRows(permissions: Permission[]): PermissionRow[] {
  // For matching "case-management:case-overview:read"
  const regex = /^([a-z-]+):([a-z-]+):([a-z-]+)$/;
  const permsMap: { [key: string]: { [key: string]: { [key: string]: boolean } } } = {};

  // Initialise a map with each permission keyed.
  PERMISSIONS.forEach((p) => {
    const matches = p.match(regex);
    if (matches?.length !== 4) {
      return;
    }
    const [, section, subsection, action] = matches;
    let permSection = permsMap[section];
    if (!permSection) {
      permSection = {};
      permsMap[section] = permSection;
    }
    let permSubsection = permSection[subsection];
    if (!permSubsection) {
      permSubsection = {};
      permSection[subsection] = permSubsection;
    }
    permSubsection[action] = false;
  });

  // Set true for permissions that the role has.
  permissions.forEach((p) => {
    const matches = p.match(regex);
    if (matches?.length !== 4) {
      return;
    }
    const [, section, subsection, action] = matches;
    if (permsMap[section][subsection] !== undefined) {
      permsMap[section][subsection][action] = true;
    }
  });

  return Object.keys(permsMap)
    .sort()
    .map((section) => ({
      name: section,
      subsections: Object.keys(permsMap[section])
        .sort()
        .map((subsection) => ({
          name: subsection,
          actions: Object.keys(permsMap[section][subsection])
            .sort()
            .map((action) => ({
              name: action,
              enabled: permsMap[section][subsection][action],
            })),
        })),
    }));
}
