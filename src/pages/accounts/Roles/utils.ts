import { Permission } from '@/apis';
import { PermissionRow } from '@/pages/accounts/Roles/types';
import { PERMISSIONS } from '@/apis/models-custom/Permission';

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
export function permissionsToRows(permissions: Permission[]): PermissionRow[] {
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

    if (permsMap[section] && permsMap[section][subsection] !== undefined) {
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
          section,
          actions: Object.keys(permsMap[section][subsection])
            .sort()
            .map((action) => ({
              name: action,
              enabled: permsMap[section][subsection][action],
              key: `${section}:${subsection}:${action}` as Permission,
            })),
        })),
    }));
}
