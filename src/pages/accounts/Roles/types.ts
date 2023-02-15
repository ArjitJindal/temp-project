export type PermissionRow = { name: string; subsections: PermissionSubsection[] };
export type PermissionSubsection = { name: string; actions: PermissionAction[] };
export type PermissionAction = { name: string; enabled: boolean };
