import { addedMentionIds, mentionedIds, snippet } from '@/lib/mentions';
import { sendNotifications, type NewNotification } from '@/lib/notifications';
import { ROLE_LABEL } from '@/lib/permissions';
import { featureStatus } from '@/lib/tests';
import { useAuthStore } from '@/stores/useAuthStore';
import { dueInDays } from '@/stores/useIssueStore';
import {
  SEVERITY_LABEL,
  type IssueCard,
  type IssueCardPatch,
  type IssueStatus,
  type MemberRole,
  type NewRejection,
  type NewTestFeature,
  type TestAnswerInput,
  type TestFeature,
  type TestNote,
  type WorkspaceMember,
} from '@/types';

interface Ctx {
  workspaceId: string;
  meId: string;
  meName: string;
  members: WorkspaceMember[];
}

type Base = Omit<NewNotification, 'userId' | 'workspaceId'>;

function context(): Ctx | null {
  const auth = useAuthStore.getState();
  const me = auth.profile;
  if (!me || !auth.activeWorkspaceId) return null;
  return {
    workspaceId: auth.activeWorkspaceId,
    meId: me.id,
    meName: me.displayName || me.email,
    members: auth.members,
  };
}

function run(work: (ctx: Ctx) => NewNotification[]): void {
  void (async () => {
    const ctx = context();
    if (!ctx) return;
    await sendNotifications(work(ctx), ctx.meName);
  })().catch(err => console.warn('notifications: event failed', err));
}

function tell(
  ctx: Ctx,
  ids: Iterable<string | null | undefined>,
  base: Base,
  skip: Iterable<string> = [],
): NewNotification[] {
  const known = new Set(ctx.members.map(m => m.userId));
  const skipped = new Set(skip);
  const out: NewNotification[] = [];
  for (const id of new Set(ids)) {
    if (!id || id === ctx.meId || skipped.has(id) || !known.has(id)) continue;
    out.push({ ...base, workspaceId: ctx.workspaceId, userId: id });
  }
  return out;
}

function idByName(ctx: Ctx, name: string): string | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  return ctx.members.find(m => m.displayName.toLowerCase() === key)?.userId ?? null;
}

function collectMentions(
  ctx: Ctx,
  pieces: { before?: string; after: string }[],
): Map<string, string> {
  const found = new Map<string, string>();
  for (const piece of pieces) {
    const ids = piece.before === undefined
      ? mentionedIds(piece.after, ctx.members)
      : addedMentionIds(piece.before, piece.after, ctx.members);
    for (const id of ids) if (!found.has(id)) found.set(id, piece.after);
  }
  return found;
}

function mentionItems(
  ctx: Ctx,
  found: Map<string, string>,
  where: string,
  link: Pick<Base, 'linkKind' | 'linkRef' | 'linkSub'>,
  dedupeSeed?: string,
): NewNotification[] {
  const out: NewNotification[] = [];
  for (const [id, text] of found) {
    out.push(
      ...tell(ctx, [id], {
        kind: 'mention',
        title: `${ctx.meName} mentioned you in ${where}`,
        body: snippet(text),
        ...link,
        dedupeKey: dedupeSeed ? `mention:${dedupeSeed}:${id}` : undefined,
      }),
    );
  }
  return out;
}

const CARD_TEXT = ['title', 'description', 'evidence', 'recommendation', 'testProcedure'] as const;

function cardLink(card: IssueCard): Pick<Base, 'linkKind' | 'linkRef'> {
  return { linkKind: 'issue', linkRef: card.id };
}

let filed: { workspaceId: string; cards: IssueCard[] } | null = null;
let filedTimer: ReturnType<typeof setTimeout> | null = null;

function flushFiled(): void {
  const batch = filed;
  filed = null;
  filedTimer = null;
  if (!batch) return;
  run(ctx => {
    if (ctx.workspaceId !== batch.workspaceId) return [];
    const named = new Set<string>();
    for (const card of batch.cards) {
      for (const field of CARD_TEXT) {
        mentionedIds(card[field], ctx.members).forEach(id => named.add(id));
      }
    }
    const first = batch.cards[0];
    const many = batch.cards.length > 1;
    return tell(
      ctx,
      ctx.members.map(m => m.userId),
      {
        kind: 'card_new',
        title: many ? `${ctx.meName} filed ${batch.cards.length} cards` : `${ctx.meName} filed ${first.id}`,
        body: many ? batch.cards.map(c => c.id).join(', ') : first.title,
        ...cardLink(first),
      },
      named,
    );
  });
}

export function notifyCardFiled(card: IssueCard): void {
  run(ctx => {
    const found = collectMentions(ctx, CARD_TEXT.map(field => ({ after: card[field] })));
    return mentionItems(ctx, found, card.id, cardLink(card));
  });
  const workspaceId = useAuthStore.getState().activeWorkspaceId;
  if (!workspaceId) return;
  if (filed && filed.workspaceId !== workspaceId) flushFiled();
  filed = { workspaceId, cards: [...(filed?.cards ?? []), card] };
  if (filedTimer) clearTimeout(filedTimer);
  filedTimer = setTimeout(flushFiled, 2500);
}

export function notifyCardEdited(before: IssueCard, patch: IssueCardPatch): void {
  run(ctx => {
    const pieces = CARD_TEXT.flatMap(field => {
      const next = patch[field];
      return typeof next === 'string' ? [{ before: before[field], after: next }] : [];
    });
    return mentionItems(ctx, collectMentions(ctx, pieces), before.id, cardLink(before));
  });
}

export function notifyCardComment(card: IssueCard, text: string): void {
  run(ctx => {
    const found = collectMentions(ctx, [{ after: text }]);
    const people = [
      card.createdBy,
      idByName(ctx, card.fixedBy),
      ...card.comments.map(c => c.authorId),
    ];
    return [
      ...mentionItems(ctx, found, card.id, cardLink(card)),
      ...tell(
        ctx,
        people,
        {
          kind: 'card_comment',
          title: `${ctx.meName} commented on ${card.id}`,
          body: snippet(text),
          ...cardLink(card),
        },
        found.keys(),
      ),
    ];
  });
}

export function notifyCardStatus(
  card: IssueCard,
  status: IssueStatus,
  testProcedure?: string,
): void {
  run(ctx => {
    if (status === 'fixed') {
      const procedure = testProcedure?.trim() || card.testProcedure;
      const found = collectMentions(ctx, [{ before: card.testProcedure, after: procedure }]);
      return [
        ...mentionItems(ctx, found, card.id, cardLink(card)),
        ...tell(
          ctx,
          [card.createdBy],
          {
            kind: 'card_fixed',
            title: `${ctx.meName} marked ${card.id} fixed`,
            body: `Check it: ${snippet(procedure, 110)}`,
            ...cardLink(card),
          },
          found.keys(),
        ),
      ];
    }
    if (status === 'resolved' || status === 'wontfix') {
      return tell(ctx, [card.createdBy, idByName(ctx, card.fixedBy)], {
        kind: 'card_closed',
        title: `${card.id} was ${status === 'wontfix' ? 'closed as wontfix' : 'resolved'} by ${ctx.meName}`,
        body: card.title,
        ...cardLink(card),
      });
    }
    return [];
  });
}

export function notifyRejection(card: IssueCard, input: NewRejection): void {
  run(ctx => {
    const found = collectMentions(ctx, [{ after: input.reason }, { after: input.tested }]);
    const owner = idByName(ctx, card.fixedBy) ?? card.createdBy;
    return [
      ...mentionItems(ctx, found, card.id, cardLink(card)),
      ...tell(
        ctx,
        [owner],
        {
          kind: 'card_rejected',
          title: `${ctx.meName} sent ${card.id} back`,
          body: `${SEVERITY_LABEL[input.severity]}: ${snippet(input.reason, 110)}`,
          ...cardLink(card),
        },
        found.keys(),
      ),
    ];
  });
}

export function notifyDueDates(cards: IssueCard[]): void {
  run(ctx =>
    cards.flatMap(card => {
      if (card.createdBy !== ctx.meId || card.status !== 'open' || !card.dueDate) return [];
      const left = dueInDays(card);
      if (left === null || left >= 3) return [];
      const late = left < 0;
      const when = left < 1 ? 'today' : left < 2 ? 'tomorrow' : 'in 2 days';
      return [
        {
          workspaceId: ctx.workspaceId,
          userId: ctx.meId,
          kind: 'card_due' as const,
          title: late ? `${card.id} is past due` : `${card.id} is due ${when}`,
          body: card.title,
          ...cardLink(card),
          dedupeKey: `due:${card.rowId}:${card.dueDate}:${late ? 'late' : 'soon'}`,
        },
      ];
    }),
  );
}

function featureText(feature: NewTestFeature | TestFeature): string {
  return [
    feature.title,
    feature.done,
    ...feature.groups.flatMap(g => [g.title, g.setup, ...g.steps.flatMap(s => [s.how, s.expected])]),
  ].join('\n');
}

export function notifyFeatureSaved(
  key: string,
  input: NewTestFeature,
  before: TestFeature | null,
): void {
  run(ctx => {
    const found = collectMentions(ctx, [
      { before: before ? featureText(before) : undefined, after: featureText(input) },
    ]);
    const link = { linkKind: 'test' as const, linkRef: key };
    return [
      ...mentionItems(ctx, found, key, link),
      ...(before
        ? []
        : tell(
            ctx,
            ctx.members.map(m => m.userId),
            { kind: 'test_new', title: `${ctx.meName} published ${key}`, body: input.title, ...link },
            found.keys(),
          )),
    ];
  });
}

export function notifyRetest(feature: TestFeature, round: number): void {
  run(ctx =>
    tell(ctx, [feature.createdBy, ...feature.results.map(r => r.userId)], {
      kind: 'test_retest',
      title: `${feature.key} is open for round ${round}`,
      body: feature.title,
      linkKind: 'test',
      linkRef: feature.key,
    }),
  );
}

export function notifyAnswer(
  feature: TestFeature,
  stepCode: string,
  input: TestAnswerInput,
  resultId: string,
): void {
  run(ctx => {
    const link = { linkKind: 'test' as const, linkRef: feature.key, linkSub: stepCode };
    if (input.result === 'fail') {
      const found = collectMentions(ctx, [{ after: input.why }, { after: input.repro }]);
      return [
        ...mentionItems(ctx, found, `${feature.key} ${stepCode}`, link, resultId),
        ...tell(
          ctx,
          [feature.createdBy],
          {
            kind: 'test_failed',
            title: `${ctx.meName} marked ${feature.key} ${stepCode} broken`,
            body: snippet(input.why),
            ...link,
            dedupeKey: `fail:${resultId}`,
          },
          found.keys(),
        ),
      ];
    }
    if (featureStatus(feature) !== 'passed') return [];
    return tell(ctx, [feature.createdBy], {
      kind: 'test_passed',
      title: `${feature.key} passed every step`,
      body: feature.title,
      linkKind: 'test',
      linkRef: feature.key,
      dedupeKey: `passed:${feature.id}:${feature.round}`,
    });
  });
}

export function notifyTestNote(feature: TestFeature, text: string, earlier: TestNote[]): void {
  run(ctx => {
    const link = { linkKind: 'test' as const, linkRef: feature.key };
    const found = collectMentions(ctx, [{ after: text }]);
    return [
      ...mentionItems(ctx, found, feature.key, link),
      ...tell(
        ctx,
        [feature.createdBy, ...earlier.map(n => n.authorId)],
        { kind: 'test_note', title: `${ctx.meName} wrote on ${feature.key}`, body: snippet(text), ...link },
        found.keys(),
      ),
    ];
  });
}

export function notifyJoined(): void {
  run(ctx =>
    tell(
      ctx,
      ctx.members.map(m => m.userId),
      {
        kind: 'member_joined',
        title: `${ctx.meName} joined the workspace`,
        linkKind: 'profile',
        linkRef: ctx.meId,
      },
    ),
  );
}

export function notifyRole(userId: string, role: MemberRole): void {
  run(ctx =>
    tell(ctx, [userId], {
      kind: 'role_changed',
      title: `${ctx.meName} made you ${ROLE_LABEL[role]}`,
      linkKind: 'settings',
    }),
  );
}
