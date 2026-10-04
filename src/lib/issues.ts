import { idsKey, inChunks } from '@/lib/liveRefresh';
import { supabase } from '@/lib/supabase';
import type {
  Attachment,
  AttachmentHost,
  AttachmentKind,
  IssueCard,
  IssueCardPatch,
  IssueComment,
  IssueStatus,
  NewIssueCard,
  NewRejection,
  Rejection,
  RejectionSeverity,
  SetStatusOpts,
} from '@/types';

interface IssueRow {
  id: string;
  workspace_id: string;
  key: string;
  title: string;
  type: string;
  subtype: string;
  priority: string;
  status: string;
  repo: string;
  codebase: string;
  version: string;
  location: string;
  related: string[] | null;
  tags: string[] | null;
  due_date: string;
  description: string;
  evidence: string;
  recommendation: string;
  test_procedure: string;
  rejections: string;
  sheet_ref: string;
  test_ref: string | null;
  test_result_id: string | null;
  time_opened: string;
  time_fixed: string | null;
  time_closed: string | null;
  fixed_by: string | null;
  closed_by: string | null;
  updated_at: string | null;
  created_by: string | null;
  issue_comments?: CommentRow[];
  issue_attachments?: AttachmentRow[];
  issue_rejections?: RejectionRow[];
}

interface RejectionRow {
  id: string;
  issue_id: string;
  severity: string;
  reason: string;
  tested: string;
  by_name: string;
  fix_by: string;
  created_at: string;
  created_by: string | null;
}

interface AttachmentRow {
  id: string;
  issue_id: string;
  url: string;
  kind: string;
  host: string;
  name: string;
  mime: string;
  bytes: number;
  source_url: string;
  rejection_id: string | null;
  created_at: string;
  created_by: string | null;
}

interface CommentRow {
  id: string;
  author: string;
  body: string;
  created_at: string;
  created_by: string | null;
}

const SELECT =
  '*, issue_comments(id, author, body, created_at, created_by)' +
  ', issue_attachments(id, issue_id, url, kind, host, name, mime, bytes, source_url, rejection_id, created_at, created_by)' +
  ', issue_rejections(id, issue_id, severity, reason, tested, by_name, fix_by, created_at, created_by)';

export function stamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toComment(row: CommentRow): IssueComment {
  return {
    id: row.id,
    time: stamp(row.created_at),
    author: row.author,
    authorId: row.created_by,
    text: row.body,
  };
}

function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    issueId: row.issue_id,
    url: row.url,
    kind: row.kind as AttachmentKind,
    host: row.host as AttachmentHost,
    name: row.name,
    mime: row.mime,
    bytes: row.bytes,
    sourceUrl: row.source_url,
    rejectionId: row.rejection_id,
    createdAt: stamp(row.created_at),
    createdBy: row.created_by,
  };
}

function toRejection(row: RejectionRow, attachments: Attachment[]): Rejection {
  return {
    id: row.id,
    issueId: row.issue_id,
    time: stamp(row.created_at),
    severity: (row.severity || 'still-broken') as RejectionSeverity,
    reason: row.reason,
    tested: row.tested,
    by: row.by_name,
    byId: row.created_by,
    fixBy: row.fix_by ?? '',
    attachments: attachments.filter(a => a.rejectionId === row.id),
  };
}

function toCard(row: IssueRow): IssueCard {
  const attachments = (row.issue_attachments ?? [])
    .map(toAttachment)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    id: row.key,
    rowId: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    type: row.type,
    subtype: row.subtype,
    priority: (row.priority || 'medium') as IssueCard['priority'],
    status: (row.status || 'open') as IssueStatus,
    repo: row.repo,
    codebase: row.codebase,
    version: row.version,
    sheetRef: row.sheet_ref ?? '',
    testRef: row.test_ref ?? '',
    testResultId: row.test_result_id ?? null,
    location: row.location,
    related: row.related ?? [],
    tags: row.tags ?? [],
    dueDate: row.due_date ?? '',
    description: row.description,
    evidence: row.evidence,
    recommendation: row.recommendation,
    testProcedure: row.test_procedure,
    rejections: row.rejections,
    timeOpened: stamp(row.time_opened),
    timeFixed: stamp(row.time_fixed),
    timeClosed: stamp(row.time_closed),
    fixedBy: row.fixed_by ?? '',
    closedBy: row.closed_by ?? '',
    updatedAt: stamp(row.updated_at),
    revision: row.updated_at ?? '',
    createdBy: row.created_by,
    rejectionList: (row.issue_rejections ?? [])
      .map(r => toRejection(r, attachments))
      .sort((a, b) => a.time.localeCompare(b.time)),
    comments: (row.issue_comments ?? [])
      .map(toComment)
      .sort((a, b) => a.time.localeCompare(b.time)),
    attachments: attachments.filter(a => !a.rejectionId),
  };
}

export async function sessionUser(): Promise<{ id: string } | null> {
  return (await supabase().auth.getSession()).data.session?.user ?? null;
}

type WriteRow = Partial<Record<string, unknown>>;

function toRow(patch: IssueCardPatch | NewIssueCard): WriteRow {
  const row: WriteRow = {};
  const map: Record<string, string> = {
    title: 'title',
    type: 'type',
    subtype: 'subtype',
    priority: 'priority',
    repo: 'repo',
    codebase: 'codebase',
    version: 'version',
    sheetRef: 'sheet_ref',
    location: 'location',
    related: 'related',
    tags: 'tags',
    dueDate: 'due_date',
    description: 'description',
    evidence: 'evidence',
    recommendation: 'recommendation',
    testProcedure: 'test_procedure',
  };
  for (const [key, column] of Object.entries(map)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value !== undefined) row[column] = value;
  }
  return row;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('The card is gone, reload the list');
  return result.data;
}

export async function listIssues(workspaceId: string): Promise<IssueCard[]> {
  const result = await supabase()
    .from('issues')
    .select(SELECT)
    .eq('workspace_id', workspaceId)
    .order('seq', { ascending: true });
  return (unwrap(result) as unknown as IssueRow[]).map(toCard);
}

export async function listIssuesById(rowIds: string[]): Promise<IssueCard[]> {
  const result = await supabase().from('issues').select(SELECT).in('id', rowIds);
  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as unknown as IssueRow[]).map(toCard);
}

interface IssueDigestRow {
  id: string;
  updated_at: string | null;
  issue_comments: { id: string }[];
  issue_attachments: { id: string }[];
  issue_rejections: { id: string }[];
}

export async function syncIssues(workspaceId: string, known: IssueCard[]): Promise<IssueCard[]> {
  const result = await supabase()
    .from('issues')
    .select('id, updated_at, issue_comments(id), issue_attachments(id), issue_rejections(id)')
    .eq('workspace_id', workspaceId)
    .order('seq', { ascending: true });
  if (result.error) throw new Error(result.error.message);
  const digest = (result.data ?? []) as unknown as IssueDigestRow[];

  const have = new Map(known.map(c => [c.rowId, c]));
  const stale = digest
    .filter(row => {
      const card = have.get(row.id);
      if (!card) return true;
      const files = [...card.attachments, ...card.rejectionList.flatMap(r => r.attachments)];
      return (
        (row.updated_at ?? '') !== card.revision ||
        idsKey(row.issue_comments) !== idsKey(card.comments) ||
        idsKey(row.issue_attachments) !== idsKey(files) ||
        idsKey(row.issue_rejections) !== idsKey(card.rejectionList)
      );
    })
    .map(row => row.id);

  const fetched = new Map((await inChunks(stale, 40, listIssuesById)).map(c => [c.rowId, c]));
  return digest.flatMap(row => {
    const card = fetched.get(row.id) ?? have.get(row.id);
    return card ? [card] : [];
  });
}

export async function getIssue(rowId: string): Promise<IssueCard> {
  const result = await supabase().from('issues').select(SELECT).eq('id', rowId).single();
  return toCard(unwrap(result) as unknown as IssueRow);
}

export async function createIssue(workspaceId: string, input: NewIssueCard): Promise<IssueCard> {
  const user = await sessionUser();
  const result = await supabase()
    .from('issues')
    .insert({ ...toRow(input), workspace_id: workspaceId, created_by: user?.id ?? null, seq: 0, key: '' })
    .select(SELECT)
    .single();
  return toCard(unwrap(result) as unknown as IssueRow);
}

export async function updateIssue(rowId: string, patch: IssueCardPatch): Promise<IssueCard> {
  const row = toRow(patch);
  if (Object.keys(row).length === 0) return getIssue(rowId);
  const result = await supabase().from('issues').update(row).eq('id', rowId).select(SELECT).single();
  return toCard(unwrap(result) as unknown as IssueRow);
}

export async function setIssueStatus(
  rowId: string,
  status: IssueStatus,
  opts: SetStatusOpts = {},
  known?: IssueCard,
): Promise<IssueCard> {
  if ((status === 'resolved' || status === 'wontfix') && !opts.humanConfirmed) {
    throw new Error(`Marking a card ${status} has to be confirmed by a person`);
  }

  const current = known ?? (await getIssue(rowId));
  const testProcedure = opts.testProcedure?.trim() || current.testProcedure;
  if (status === 'fixed' && !testProcedure) {
    throw new Error('A card marked fixed needs a test procedure, write how to check the fix');
  }
  if (status === 'open' && current.status === 'fixed') {
    throw new Error('Send a fixed card back to open by rejecting it, so the reason is kept');
  }

  const who = opts.author?.trim() || '';
  const row: WriteRow = { status };
  if (status === 'fixed') {
    row.test_procedure = testProcedure;
    row.fixed_by = who;
  }
  if (status === 'resolved' || status === 'wontfix') row.closed_by = who;
  const result = await supabase().from('issues').update(row).eq('id', rowId).select(SELECT).single();
  return toCard(unwrap(result) as unknown as IssueRow);
}

export interface RejectResult {
  card: IssueCard;
  rejectionId: string;
}

export async function rejectIssue(
  rowId: string,
  input: NewRejection,
  author = '',
  known?: IssueCard,
): Promise<RejectResult> {
  const reason = input.reason.trim();
  if (!reason) throw new Error('A rejection needs a reason');

  const current = known ?? (await getIssue(rowId));
  if (current.status !== 'fixed') throw new Error('Only a fixed card can be rejected');

  const user = await sessionUser();
  const who = author.trim() || 'Unknown';

  const inserted = await supabase()
    .from('issue_rejections')
    .insert({
      issue_id: rowId,
      severity: input.severity,
      reason,
      tested: input.tested.trim(),
      by_name: who,
      fix_by: current.fixedBy,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();
  if (inserted.error) throw new Error(inserted.error.message);

  const line = `- ${stamp(new Date().toISOString())} | ${who}: ${reason.replace(/\r?\n/g, ' ')}`;
  const rejections = current.rejections ? `${current.rejections}\n${line}` : line;

  const result = await supabase()
    .from('issues')
    .update({ status: 'open', rejections })
    .eq('id', rowId)
    .select(SELECT)
    .single();

  return { card: toCard(unwrap(result) as unknown as IssueRow), rejectionId: (inserted.data as { id: string }).id };
}

export async function updateRejection(
  rejectionId: string,
  rowId: string,
  patch: Partial<NewRejection>,
): Promise<IssueCard> {
  const row: WriteRow = {};
  if (patch.severity !== undefined) row.severity = patch.severity;
  if (patch.reason !== undefined) row.reason = patch.reason.trim();
  if (patch.tested !== undefined) row.tested = patch.tested.trim();

  const { error } = await supabase().from('issue_rejections').update(row).eq('id', rejectionId);
  if (error) throw new Error(error.message);
  return getIssue(rowId);
}

export async function commentOnIssue(rowId: string, text: string, author: string): Promise<IssueCard> {
  const body = text.trim();
  if (!body) throw new Error('A comment needs text');

  const user = await sessionUser();
  const insert = await supabase()
    .from('issue_comments')
    .insert({ issue_id: rowId, author, body, created_by: user?.id ?? null });
  if (insert.error) throw new Error(insert.error.message);
  return getIssue(rowId);
}

export async function deleteComment(commentId: string, rowId: string): Promise<IssueCard> {
  const result = await supabase().from('issue_comments').delete().eq('id', commentId);
  if (result.error) throw new Error(result.error.message);
  return getIssue(rowId);
}

export async function deleteIssue(rowId: string): Promise<void> {
  const result = await supabase().from('issues').delete().eq('id', rowId);
  if (result.error) throw new Error(result.error.message);
}

export async function listReads(workspaceId: string): Promise<Record<string, string>> {
  const user = await sessionUser();
  if (!user) return {};

  const result = await supabase()
    .from('issue_reads')
    .select('issue_id, seen_at, issues!inner(workspace_id)')
    .eq('user_id', user.id)
    .eq('issues.workspace_id', workspaceId);

  const rows = unwrap(result) as { issue_id: string; seen_at: string }[];
  const seen: Record<string, string> = {};
  for (const row of rows) seen[row.issue_id] = stamp(row.seen_at);
  return seen;
}

export async function markRead(rowIds: string[], seenAt: string): Promise<void> {
  if (rowIds.length === 0) return;
  const user = await sessionUser();
  if (!user) return;

  const parsed = new Date(seenAt.replace(' ', 'T'));
  const iso = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();

  const { error } = await supabase()
    .from('issue_reads')
    .upsert(
      rowIds.map(id => ({ issue_id: id, user_id: user.id, seen_at: iso })),
      { onConflict: 'issue_id,user_id' },
    );
  if (error) throw new Error(error.message);
}

export interface NewAttachment {
  url: string;
  kind: AttachmentKind;
  host: AttachmentHost;
  name: string;
  mime?: string;
  bytes?: number;
  sourceUrl?: string;
}

export async function attachToIssue(
  rowId: string,
  input: NewAttachment,
  rejectionId: string | null = null,
): Promise<IssueCard> {
  const user = await sessionUser();
  const { error } = await supabase().from('issue_attachments').insert({
    issue_id: rowId,
    rejection_id: rejectionId,
    url: input.url,
    kind: input.kind,
    host: input.host,
    name: input.name,
    mime: input.mime ?? '',
    bytes: input.bytes ?? 0,
    source_url: input.sourceUrl ?? '',
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  return getIssue(rowId);
}

export async function detachFromIssue(attachmentId: string, rowId: string): Promise<IssueCard> {
  const { error } = await supabase().from('issue_attachments').delete().eq('id', attachmentId);
  if (error) throw new Error(error.message);
  return getIssue(rowId);
}
