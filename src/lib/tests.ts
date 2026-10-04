import { sessionUser, stamp, type NewAttachment } from '@/lib/issues';
import { idsKey, inChunks } from '@/lib/liveRefresh';
import { supabase } from '@/lib/supabase';
import type {
  AttachmentHost,
  AttachmentKind,
  FeatureStatus,
  NewTestFeature,
  StepStatus,
  TestAnswer,
  TestAnswerInput,
  TestAttachment,
  TestFeature,
  TestGroup,
  TestNote,
  TestResult,
  TestStep,
} from '@/types';

interface AttachmentRow {
  id: string;
  result_id: string;
  url: string;
  kind: string;
  host: string;
  name: string;
  mime: string;
  bytes: number;
  source_url: string;
  created_at: string;
  created_by: string | null;
}

interface ResultRow {
  id: string;
  step_id: string;
  feature_id: string;
  user_id: string;
  tester_name: string;
  result: string;
  why: string;
  repro: string;
  round: number;
  superseded: boolean;
  created_at: string;
  updated_at: string;
  test_attachments?: AttachmentRow[];
}

interface StepRow {
  id: string;
  group_id: string;
  num: number;
  how: string;
  expected: string;
  position: number;
}

interface GroupRow {
  id: string;
  letter: string;
  title: string;
  setup: string;
  position: number;
  test_steps?: StepRow[];
}

interface FeatureRow {
  id: string;
  workspace_id: string;
  seq: number;
  key: string;
  title: string;
  version: string;
  done: string;
  round: number;
  archived: boolean;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  test_groups?: GroupRow[];
  test_results?: ResultRow[];
}

const SELECT =
  '*, test_groups!feature_id(*, test_steps!group_id(*))' +
  ', test_results!feature_id(*, test_attachments!result_id(*))';

function toAttachment(row: AttachmentRow): TestAttachment {
  return {
    id: row.id,
    resultId: row.result_id,
    url: row.url,
    kind: row.kind as AttachmentKind,
    host: row.host as AttachmentHost,
    name: row.name,
    mime: row.mime,
    bytes: row.bytes,
    sourceUrl: row.source_url,
    createdAt: stamp(row.created_at),
    createdBy: row.created_by,
  };
}

function toResult(row: ResultRow): TestResult {
  return {
    id: row.id,
    stepId: row.step_id,
    featureId: row.feature_id,
    userId: row.user_id,
    testerName: row.tester_name,
    result: row.result as TestAnswer,
    why: row.why,
    repro: row.repro,
    round: row.round,
    superseded: row.superseded,
    createdAt: stamp(row.created_at),
    updatedAt: stamp(row.updated_at),
    revision: row.updated_at,
    attachments: (row.test_attachments ?? [])
      .map(toAttachment)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

function toGroup(row: GroupRow): TestGroup {
  const steps: TestStep[] = (row.test_steps ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(s => ({
      id: s.id,
      groupId: s.group_id,
      num: s.num,
      code: `${row.letter}${s.num}`,
      how: s.how,
      expected: s.expected,
    }));
  return { id: row.id, letter: row.letter, title: row.title, setup: row.setup, steps };
}

function toFeature(row: FeatureRow): TestFeature {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    key: row.key,
    seq: row.seq,
    title: row.title,
    version: row.version,
    done: row.done,
    round: row.round,
    archived: row.archived,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: stamp(row.created_at),
    updatedAt: stamp(row.updated_at),
    revision: row.updated_at,
    groups: (row.test_groups ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toGroup),
    results: (row.test_results ?? [])
      .map(toResult)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

interface NoteRow {
  id: string;
  feature_id: string;
  author: string;
  body: string;
  created_at: string;
  created_by: string | null;
}

function toNote(row: NoteRow): TestNote {
  return {
    id: row.id,
    featureId: row.feature_id,
    author: row.author,
    authorId: row.created_by,
    time: stamp(row.created_at),
    text: row.body,
  };
}

export async function listNotes(workspaceId: string): Promise<TestNote[]> {
  const result = await supabase()
    .from('test_notes')
    .select('id, feature_id, author, body, created_at, created_by')
    .eq('workspace_id', workspaceId)
    .not('feature_id', 'is', null)
    .order('created_at', { ascending: true });
  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as NoteRow[]).map(toNote);
}

export async function listNotesFor(featureIds: string[]): Promise<TestNote[]> {
  const result = await supabase()
    .from('test_notes')
    .select('id, feature_id, author, body, created_at, created_by')
    .in('feature_id', featureIds)
    .order('created_at', { ascending: true });
  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as NoteRow[]).map(toNote);
}

export async function listFeaturesById(featureIds: string[]): Promise<TestFeature[]> {
  const result = await supabase().from('test_features').select(SELECT).in('id', featureIds);
  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as unknown as FeatureRow[]).map(toFeature);
}

interface FeatureDigestRow {
  id: string;
  updated_at: string;
  test_groups: { id: string }[];
  test_results: { id: string; updated_at: string; test_attachments: { id: string }[] }[];
}

function featureSignature(feature: TestFeature): string {
  const results = feature.results.map(r => `${r.id}@${r.revision}:${idsKey(r.attachments)}`).sort();
  return `${feature.revision}|${idsKey(feature.groups)}|${results.join(';')}`;
}

function digestSignature(row: FeatureDigestRow): string {
  const results = row.test_results
    .map(r => `${r.id}@${r.updated_at}:${idsKey(r.test_attachments)}`)
    .sort();
  return `${row.updated_at}|${idsKey(row.test_groups)}|${results.join(';')}`;
}

export async function syncFeatures(workspaceId: string, known: TestFeature[]): Promise<TestFeature[]> {
  const result = await supabase()
    .from('test_features')
    .select('id, updated_at, test_groups!feature_id(id), test_results!feature_id(id, updated_at, test_attachments!result_id(id))')
    .eq('workspace_id', workspaceId)
    .order('seq', { ascending: true });
  if (result.error) throw new Error(result.error.message);
  const digest = (result.data ?? []) as unknown as FeatureDigestRow[];

  const have = new Map(known.map(f => [f.id, f]));
  const stale = digest
    .filter(row => {
      const feature = have.get(row.id);
      return !feature || featureSignature(feature) !== digestSignature(row);
    })
    .map(row => row.id);

  const fetched = new Map((await inChunks(stale, 25, listFeaturesById)).map(f => [f.id, f]));
  return digest.flatMap(row => {
    const feature = fetched.get(row.id) ?? have.get(row.id);
    return feature ? [feature] : [];
  });
}

export async function featureIdOfResult(resultId: string): Promise<string | null> {
  const result = await supabase().from('test_results').select('feature_id').eq('id', resultId).maybeSingle();
  return (result.data as { feature_id: string } | null)?.feature_id ?? null;
}

export async function addNote(
  workspaceId: string,
  featureId: string,
  text: string,
  author: string,
): Promise<void> {
  const body = text.trim();
  if (!body) throw new Error('A note needs text');
  const user = await sessionUser();
  const { error } = await supabase().from('test_notes').insert({
    workspace_id: workspaceId,
    feature_id: featureId,
    author,
    body,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase().from('test_notes').delete().eq('id', noteId);
  if (error) throw new Error(error.message);
}

export async function listFeatures(workspaceId: string): Promise<TestFeature[]> {
  const result = await supabase()
    .from('test_features')
    .select(SELECT)
    .eq('workspace_id', workspaceId)
    .order('seq', { ascending: true });
  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as unknown as FeatureRow[]).map(toFeature);
}

export async function saveFeature(
  workspaceId: string,
  featureId: string | null,
  input: NewTestFeature,
  author: string,
): Promise<string> {
  const { data, error } = await supabase().rpc('save_test_feature', {
    p_feature: featureId,
    p_workspace: workspaceId,
    p_title: input.title.trim(),
    p_version: input.version.trim(),
    p_done: input.done.trim(),
    p_author: author,
    p_groups: input.groups,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function deleteFeature(featureId: string): Promise<void> {
  const { error } = await supabase().from('test_features').delete().eq('id', featureId);
  if (error) throw new Error(error.message);
}

export async function setFeatureArchived(featureId: string, archived: boolean): Promise<void> {
  const { error } = await supabase().from('test_features').update({ archived }).eq('id', featureId);
  if (error) throw new Error(error.message);
}

export async function requestRetest(featureId: string): Promise<number> {
  const { data, error } = await supabase().rpc('request_test_retest', { p_feature: featureId });
  if (error) throw new Error(error.message);
  return data as number;
}

export async function answerStep(
  stepId: string,
  input: TestAnswerInput,
  testerName: string,
): Promise<string> {
  const user = await sessionUser();
  if (!user) throw new Error('Sign in again to answer a step');

  const row =
    input.result === 'fail'
      ? { result: 'fail', why: input.why.trim(), repro: input.repro.trim(), tester_name: testerName }
      : { result: 'pass', tester_name: testerName };

  const live = await supabase()
    .from('test_results')
    .select('id')
    .eq('step_id', stepId)
    .eq('user_id', user.id)
    .eq('superseded', false)
    .maybeSingle();
  if (live.error) throw new Error(live.error.message);

  if (live.data) {
    const { error } = await supabase().from('test_results').update(row).eq('id', live.data.id);
    if (error) throw new Error(error.message);
    return live.data.id as string;
  }

  const inserted = await supabase()
    .from('test_results')
    .insert({ ...row, step_id: stepId, user_id: user.id })
    .select('id')
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  return inserted.data.id as string;
}

export async function fileTestIssue(resultId: string): Promise<string> {
  const { data, error } = await supabase().rpc('file_test_issue', { p_result: resultId });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function clearAnswer(resultId: string): Promise<void> {
  const { error } = await supabase().from('test_results').delete().eq('id', resultId);
  if (error) throw new Error(error.message);
}

export async function attachToResult(resultId: string, input: NewAttachment): Promise<void> {
  const user = await sessionUser();
  const { error } = await supabase().from('test_attachments').insert({
    result_id: resultId,
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
}

export async function detachFromResult(attachmentId: string): Promise<void> {
  const { error } = await supabase().from('test_attachments').delete().eq('id', attachmentId);
  if (error) throw new Error(error.message);
}

export function liveResults(feature: TestFeature): TestResult[] {
  return feature.results.filter(r => !r.superseded);
}

export function stepResults(feature: TestFeature, stepId: string): TestResult[] {
  return liveResults(feature).filter(r => r.stepId === stepId);
}

export function stepStatus(feature: TestFeature, stepId: string): StepStatus {
  const answers = stepResults(feature, stepId);
  if (answers.some(r => r.result === 'fail')) return 'failed';
  if (answers.some(r => r.result === 'pass')) return 'passed';
  return 'untested';
}

export function allSteps(feature: TestFeature): TestStep[] {
  return feature.groups.flatMap(g => g.steps);
}

export function featureStatus(feature: TestFeature): FeatureStatus {
  const steps = allSteps(feature);
  const states = steps.map(s => stepStatus(feature, s.id));
  if (states.includes('failed')) return 'failing';
  if (steps.length > 0 && states.every(s => s === 'passed')) return 'passed';
  if (states.some(s => s === 'passed')) return 'testing';
  return 'untested';
}

export function myAnswer(feature: TestFeature, stepId: string, userId: string): TestResult | null {
  return stepResults(feature, stepId).find(r => r.userId === userId) ?? null;
}

export function needsTester(feature: TestFeature, userId: string): boolean {
  if (feature.archived || featureStatus(feature) === 'passed') return false;
  return allSteps(feature).some(s => !myAnswer(feature, s.id, userId));
}

export interface StepCount {
  total: number;
  passed: number;
  failed: number;
}

export function countSteps(feature: TestFeature): StepCount {
  const states = allSteps(feature).map(s => stepStatus(feature, s.id));
  return {
    total: states.length,
    passed: states.filter(s => s === 'passed').length,
    failed: states.filter(s => s === 'failed').length,
  };
}
