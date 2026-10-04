import type { MemberRole } from '@/types';

export const ASSIGNABLE_ROLES: Exclude<MemberRole, 'owner' | 'reader'>[] = [
  'admin',
  'editor',
  'viewer',
];

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
  reader: 'Reader',
};

export const ROLE_NOTE: Record<MemberRole, string> = {
  owner: 'Made this workspace. Everything, and cannot be removed from it',
  admin: 'Files and closes cards, invites people, and sets everyone else’s role',
  editor: 'Files, edits, closes and deletes cards',
  viewer: 'Reads the cards and the notes, changes nothing',
  reader: 'Reads the cards, changes nothing',
};

export interface Permissions {
  writeCards: boolean;
  deleteCards: boolean;
  editWorkspace: boolean;
  managePeople: boolean;
  manageAdmins: boolean;
  writeFeatures: boolean;
  markTests: boolean;
  importTests: boolean;
}

const NONE: Permissions = {
  writeCards: false,
  deleteCards: false,
  editWorkspace: false,
  managePeople: false,
  manageAdmins: false,
  writeFeatures: false,
  markTests: false,
  importTests: false,
};

const BY_ROLE: Record<MemberRole, Permissions> = {
  owner: {
    writeCards: true,
    deleteCards: true,
    editWorkspace: true,
    managePeople: true,
    manageAdmins: true,
    writeFeatures: true,
    markTests: true,
    importTests: true,
  },
  admin: {
    writeCards: true,
    deleteCards: true,
    editWorkspace: true,
    managePeople: true,
    manageAdmins: false,
    writeFeatures: true,
    markTests: true,
    importTests: false,
  },
  editor: { ...NONE, writeCards: true, deleteCards: true, writeFeatures: true, markTests: true },
  viewer: { ...NONE, markTests: true },
  reader: NONE,
};

export function permissionsFor(role: MemberRole | null | undefined): Permissions {
  return role ? BY_ROLE[role] : NONE;
}

export function toRole(value: string): MemberRole {
  if (value === 'owner' || value === 'admin' || value === 'viewer' || value === 'reader') return value;
  return 'editor';
}
