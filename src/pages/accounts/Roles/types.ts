export type PermissionRow = { name: string; subsections: PermissionSubsection[] };
export type PermissionSubsection = { name: string; section: string; actions: PermissionAction[] };
export type PermissionAction = { name: string; enabled: boolean };
