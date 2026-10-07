export type PanelId = 'issue-cards' | 'testing' | 'leaderboard' | 'settings';

export interface SidebarState {
  mode: 'retracted' | 'expanded';
  width: number;
}

export interface IdentityPrefs {
  click: 'profile' | 'action';
  menu: boolean;
  underline: boolean;
  shape: 'circle' | 'square';
}

export interface LayoutState {
  activePanel: PanelId;
  navSidebar: SidebarState;
  lastSelectedIssueId: string | null;
  issueColumnWidths: Record<string, number>;
  issueView: 'board' | 'table';
  issueSheetWidth: number;
  identity: IdentityPrefs;
}

export type ThemeChoice = 'system' | 'oled' | 'dark' | 'light';

export type AvatarBorder = 'none' | 'glow' | 'ring';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  accent: string;
  theme: ThemeChoice;
  density: 'normal' | 'compact';
  radius: string;
  monoUi: boolean;
  avatarUrl: string;
  bio: string;
  bannerUrl: string;
  avatarBorder: AvatarBorder;
  keys: Record<string, string>;
  activeWorkspace: string | null;
  notifyPrefs: NotifyPrefs;
}

export const NOTIFICATION_KINDS = [
  'mention',
  'card_comment',
  'card_new',
  'card_fixed',
  'card_rejected',
  'card_closed',
  'card_due',
  'test_new',
  'test_failed',
  'test_passed',
  'test_retest',
  'test_note',
  'member_joined',
  'role_changed',
  'update',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type NotificationLinkKind = 'issue' | 'test' | 'profile' | 'settings' | '';

export interface AppNotification {
  id: string;
  workspaceId: string;
  actorId: string | null;
  actorName: string;
  kind: NotificationKind;
  title: string;
  body: string;
  linkKind: NotificationLinkKind;
  linkRef: string;
  linkSub: string;
  read: boolean;
  createdAt: string;
  local: boolean;
}

export interface NotifyPrefs {
  desktop: boolean;
  kinds: Partial<Record<NotificationKind, boolean>>;
}

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'reader';

export interface Workspace {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  color: string;
  currentVersion: string;
  versions: string[];
  role: MemberRole;
  memberCount: number;
}

export interface WorkspaceMember {
  userId: string;
  role: MemberRole;
  email: string;
  displayName: string;
  initials: string;
  accent: string;
  avatarUrl: string;
  bio: string;
  bannerUrl: string;
  avatarBorder: AvatarBorder;
  joinedAt: string;
}

export type IssueStatus = 'open' | 'fixed' | 'resolved' | 'wontfix';
export type IssuePriority = 'high' | 'medium' | 'low';

export const ISSUE_TYPES = ['Duplicate', 'Bug', 'Feature', 'Change', 'Other'] as const;

export type AttachmentKind = 'image' | 'video' | 'youtube' | 'file';

export type AttachmentHost = 'imgur' | 'catbox' | 'mclogs' | 'discord' | 'youtube' | 'link';

export interface Attachment {
  id: string;
  issueId: string;
  url: string;
  kind: AttachmentKind;
  host: AttachmentHost;
  name: string;
  mime: string;
  bytes: number;
  sourceUrl: string;
  rejectionId: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface UploadResult {
  url: string;
  host: AttachmentHost;
  name: string;
  mime: string;
  bytes: number;
}

export type UploadJobState = 'queued' | 'uploading' | 'done' | 'error' | 'canceled';

export interface UploadJob {
  id: string;
  name: string;
  target: string;
  host: AttachmentHost;
  bytes: number;
  sent: number;
  state: UploadJobState;
  attempt: number;
  error: string;
  result: UploadResult | null;
}

export interface IssueComment {
  id: string;
  time: string;
  author: string;
  authorId: string | null;
  text: string;
}

export interface IssueCard {
  id: string;
  rowId: string;
  workspaceId: string;
  type: string;
  subtype: string;
  priority: IssuePriority;
  status: IssueStatus;
  timeOpened: string;
  timeFixed: string;
  timeClosed: string;
  fixedBy: string;
  closedBy: string;
  fixedVersion: string;
  closedVersion: string;
  updatedAt: string;
  revision: string;
  repo: string;
  codebase: string;
  version: string;
  sheetRef: string;
  testRef: string;
  testResultId: string | null;
  location: string;
  related: string[];
  tags: string[];
  dueDate: string;
  title: string;
  description: string;
  evidence: string;
  recommendation: string;
  testProcedure: string;
  rejections: string;
  rejectionList: Rejection[];
  comments: IssueComment[];
  attachments: Attachment[];
  createdBy: string | null;
}

export type NewIssueCard = Partial<IssueCard> & { title: string };

export type IssueCardPatch = Partial<
  Omit<
    IssueCard,
        | 'id'
    | 'rowId'
    | 'workspaceId'
    | 'status'
    | 'timeOpened'
    | 'timeFixed'
    | 'timeClosed'
    | 'rejectionList'
    | 'fixedBy'
    | 'closedBy'
    | 'fixedVersion'
    | 'closedVersion'
    | 'comments'
    | 'attachments'
    | 'createdBy'
    | 'testRef'
    | 'testResultId'
  >
>;

export const REJECTION_SEVERITIES = ['still-broken', 'partly-fixed', 'wrong-fix'] as const;

export type RejectionSeverity = (typeof REJECTION_SEVERITIES)[number];

export const SEVERITY_LABEL: Record<RejectionSeverity, string> = {
  'still-broken': 'Still broken',
  'partly-fixed': 'Partly fixed',
  'wrong-fix': 'Wrong fix',
};

export const SEVERITY_NOTE: Record<RejectionSeverity, string> = {
  'still-broken': 'Nothing changed, the issue reproduces exactly as filed',
  'partly-fixed': 'Better, but the issue still shows in some cases',
  'wrong-fix': 'The change missed the point, or broke something else',
};

export interface Rejection {
  id: string;
  issueId: string;
  time: string;
  severity: RejectionSeverity;
  reason: string;
  tested: string;
  by: string;
  byId: string | null;
  fixBy: string;
  version: string;
  attachments: Attachment[];
}

export interface NewRejection {
  version: string;
  severity: RejectionSeverity;
  reason: string;
  tested: string;
}

export interface SetStatusOpts {
  testProcedure?: string;
  version?: string;
  humanConfirmed?: boolean;
  author?: string;
}

export interface IssueHistoryEntry {
  timestamp: string;
  summary: string;
}

export const TAG_COLORS = [
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'primary',
  'success',
  'warning',
  'destructive',
  'muted-foreground',
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export interface IssueTag {
  id: string;
  name: string;
  color: TagColor;
}

export type TestAnswer = 'pass' | 'fail';
export type StepStatus = 'untested' | 'passed' | 'failed';
export type FeatureStatus = 'untested' | 'testing' | 'passed' | 'failing';

export interface TestAttachment {
  id: string;
  resultId: string;
  url: string;
  kind: AttachmentKind;
  host: AttachmentHost;
  name: string;
  mime: string;
  bytes: number;
  sourceUrl: string;
  createdAt: string;
  createdBy: string | null;
}

export interface TestResult {
  id: string;
  stepId: string;
  featureId: string;
  userId: string;
  testerName: string;
  result: TestAnswer;
  why: string;
  repro: string;
  version: string;
  round: number;
  superseded: boolean;
  createdAt: string;
  updatedAt: string;
  revision: string;
  attachments: TestAttachment[];
}

export interface TestStep {
  id: string;
  groupId: string;
  num: number;
  code: string;
  how: string;
  expected: string;
}

export interface TestGroup {
  id: string;
  letter: string;
  title: string;
  setup: string;
  steps: TestStep[];
}

export interface TestFeature {
  id: string;
  workspaceId: string;
  key: string;
  seq: number;
  title: string;
  version: string;
  done: string;
  round: number;
  archived: boolean;
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  revision: string;
  groups: TestGroup[];
  results: TestResult[];
}

export interface NewTestStep {
  num: number;
  how: string;
  expected: string;
}

export interface NewTestGroup {
  letter: string;
  title: string;
  setup: string;
  steps: NewTestStep[];
}

export interface NewTestFeature {
  title: string;
  version: string;
  done: string;
  groups: NewTestGroup[];
}

export interface TestNote {
  id: string;
  featureId: string;
  author: string;
  authorId: string | null;
  time: string;
  text: string;
}

export interface TestAnswerInput {
  version: string;
  result: TestAnswer;
  why: string;
  repro: string;
}

export type UpdateStage =
  | 'idle'
  | 'checking'
  | 'available'
  | 'none'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdateState {
  stage: UpdateStage;
  version: string;
  currentVersion: string;
  notes: string;
  percent: number;
  message: string;
  supported: boolean;
}
