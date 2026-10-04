import { useEffect, useState } from 'react';
import { Copy, Pencil, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import AttachmentTray from '@/components/shared/AttachmentTray';
import LightboxModal from '@/components/shared/AttachmentTray/LightboxModal';
import CodeBlock from '@/components/shared/CodeBlock';
import DetailViewer, { DetailMarkdown, DetailSection } from '@/components/shared/DetailViewer';
import TagBadge from '@/components/shared/TagBadge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import Notes from '@/components/shared/Notes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { lastRejection, useIssueStore } from '@/stores/useIssueStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { relTime } from '@/lib/relTime';
import { errorText } from '@/lib/supabase';
import { useAuthStore, usePermissions } from '@/stores/useAuthStore';
import { useSeenStore } from '@/stores/useSeenStore';
import { useUiStore } from '@/stores/useUiStore';
import { cardTarget } from '@/stores/useUploadStore';
import type { IssueCard } from '@/types';
import { CardFlags, FiledBy, MetaBadges, PersonLine, PriorityBadge, StatusBadge } from './IssueBits';
import RejectionHistory, { RejectionBanner } from './RejectionHistory';

interface IssueDetailSheetProps {
  card: IssueCard | null;
  onEdit: (card: IssueCard) => void;
  onSelect?: (id: string | null) => void;
}

export default function IssueDetailSheet({ card, onEdit, onSelect }: IssueDetailSheetProps) {
  const storeSelect = useIssueStore(s => s.select);
  const select = onSelect ?? storeSelect;
  const setStatus = useIssueStore(s => s.setStatus);
  const comment = useIssueStore(s => s.comment);
  const remove = useIssueStore(s => s.remove);
  const uncomment = useIssueStore(s => s.uncomment);
  const detach = useIssueStore(s => s.detach);

  const askFix = useUiStore(s => s.askFix);
  const askReject = useUiStore(s => s.askReject);

  const me = useAuthStore(s => s.profile);
  const authorName = me?.displayName || me?.email || 'Unknown';
  const can = usePermissions();

  const width = useLayoutStore(s => s.issueSheetWidth);
  const setWidth = useLayoutStore(s => s.setIssueSheetWidth);

  const markSeen = useSeenStore(s => s.markSeen);

  const [lightbox, setLightbox] = useState<{ src: string; name: string; video: boolean } | null>(null);
  const [lastCard, setLastCard] = useState<IssueCard | null>(card);

  useEffect(() => {
    if (card) setLastCard(card);
  }, [card]);

  const openId = card?.id;
  useEffect(() => {
    if (!openId) return;
    return () => {
      void markSeen([openId]);
    };
  }, [openId, markSeen]);

  const shown = card ?? lastCard;
  if (!shown) return null;

  const latest = lastRejection(shown);

  async function run(work: () => Promise<unknown>, done: string) {
    try {
      await work();
      toast.success(done);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  const badges = (
    <>
      <StatusBadge status={shown.status} />
      <PriorityBadge priority={shown.priority} />
      <Badge variant="secondary">{shown.type || 'Other'}</Badge>
      {shown.subtype && <Badge variant="outline">{shown.subtype}</Badge>}
      <MetaBadges card={shown} clickable={false} />
      {shown.tags.map(tag => (
        <TagBadge key={tag} tag={tag} />
      ))}
      <CardFlags card={shown} />
    </>
  );

  const footer = (
    <>
      {can.writeCards && (
        <Button size="sm" onClick={() => onEdit(shown)}>
          <Pencil size={15} strokeWidth={1.6} />
          Edit
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => void navigator.clipboard.writeText(shown.id).then(() => toast.success('ID copied'))}
      >
        <Copy size={15} strokeWidth={1.6} />
        Copy ID
      </Button>

      {can.writeCards && shown.status !== 'fixed' && (
        <Button variant="outline" size="sm" onClick={() => askFix(shown.id)}>
          Mark fixed
        </Button>
      )}

      {can.writeCards && shown.status === 'fixed' && (
        <Button variant="outline" size="sm" onClick={() => askReject(shown.id)}>
          <Undo2 size={15} strokeWidth={1.6} />
          Reject fix
        </Button>
      )}

      {can.writeCards && shown.status !== 'resolved' && (
        <HumanConfirm
          label="Resolve"
          title={`Resolve ${shown.id}?`}
          description="Resolved is set by a person, never by anything automated, so this is the confirmation the rule asks for."
          onConfirm={() =>
            void run(
              () => setStatus(shown.id, 'resolved', { humanConfirmed: true }),
              `${shown.id} resolved`,
            )
          }
        />
      )}

      {can.writeCards && shown.status !== 'wontfix' && (
        <HumanConfirm
          label="Wontfix"
          title={`Close ${shown.id} as wontfix?`}
          description="Wontfix is set by a person, never by anything automated, so this is the confirmation the rule asks for."
          onConfirm={() =>
            void run(
              () => setStatus(shown.id, 'wontfix', { humanConfirmed: true }),
              `${shown.id} closed as wontfix`,
            )
          }
        />
      )}

      {can.writeCards && (shown.status === 'resolved' || shown.status === 'wontfix') && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void run(() => setStatus(shown.id, 'open'), `${shown.id} reopened`)}
        >
          <RotateCcw size={15} strokeWidth={1.6} />
          Reopen
        </Button>
      )}

      {!can.writeCards && (
        <span className="text-[12px] text-muted-foreground">
          Your role in this workspace reads the cards, it does not change them
        </span>
      )}

      {can.deleteCards && (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="ml-auto">
            <Trash2 size={15} strokeWidth={1.6} />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {shown.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              The card is removed for everyone in the workspace. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void run(() => remove(shown.id), `${shown.id} deleted`)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}
    </>
  );

  return (
    <>
      <DetailViewer
        open={Boolean(card)}
        onOpenChange={open => !open && select(null)}
        width={width}
        onWidth={setWidth}
        eyebrow={shown.id}
        title={shown.title}
        badges={badges}
        subtitle={shown.location}
        footer={footer}
      >
        {latest && shown.status !== 'resolved' && shown.status !== 'wontfix' && (
          <RejectionBanner rejection={latest} />
        )}

        <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px]">
          <span className="text-muted-foreground">opened</span>
          <Stamp time={shown.timeOpened} />
          {shown.timeFixed && (
            <>
              <span className="text-muted-foreground">fixed</span>
              <Stamp time={shown.timeFixed} by={shown.fixedBy} />
            </>
          )}
          {shown.timeClosed && (
            <>
              <span className="text-muted-foreground">
                {shown.status === 'wontfix' ? 'wontfix' : 'resolved'}
              </span>
              <Stamp time={shown.timeClosed} by={shown.closedBy} />
            </>
          )}
          {shown.dueDate && (
            <>
              <span className="text-muted-foreground">due</span>
              <span className="mono">{shown.dueDate}</span>
            </>
          )}
          {shown.repo && (
            <>
              <span className="text-muted-foreground">repo</span>
              <span className="mono truncate">{shown.repo}</span>
            </>
          )}
          {shown.sheetRef && (
            <>
              <span className="text-muted-foreground">sheet</span>
              <span className="mono">{shown.sheetRef} from the bug sheet</span>
            </>
          )}
          <span className="text-muted-foreground">filed by</span>
          <FiledBy card={shown} />
        </div>

        <DetailSection title="Description">
          <DetailMarkdown text={shown.description} />
        </DetailSection>

        {shown.evidence && (
          <DetailSection title="Evidence">
            <CodeBlock code={shown.evidence} />
          </DetailSection>
        )}

        <DetailSection title="Recommendation">
          <DetailMarkdown text={shown.recommendation} />
        </DetailSection>

        {shown.testProcedure && (
          <DetailSection title="Test procedure">
            {shown.timeFixed && (
              <div className="mono flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {shown.fixedBy && (
                  <>
                    <PersonLine name={shown.fixedBy} />·
                  </>
                )}
                {shown.timeFixed}
                {relTime(shown.timeFixed) && ` · ${relTime(shown.timeFixed)}`}
              </div>
            )}
            <DetailMarkdown text={shown.testProcedure} />
          </DetailSection>
        )}

        {shown.rejectionList.length > 0 && (
          <DetailSection
            title={
              shown.rejectionList.length === 1
                ? 'The rejected fix'
                : `${shown.rejectionList.length} rejected fixes`
            }
          >
            <RejectionHistory
              rejections={shown.rejectionList}
              onOpenMedia={(src, name, video) => setLightbox({ src, name, video })}
            />
          </DetailSection>
        )}

        <DetailSection title="Attachments">
          <AttachmentTray
            target={cardTarget(shown.rowId)}
            readOnly={!can.writeCards}
            attachments={shown.attachments}
            onRemove={id => detach(shown.id, id)}
          />
        </DetailSection>

        {shown.related.length > 0 && (
          <DetailSection title="Related">
            <div className="flex flex-wrap gap-2">
              {shown.related.map(id => (
                <Button key={id} variant="outline" size="xs" onClick={() => select(id)}>
                  {id}
                </Button>
              ))}
            </div>
          </DetailSection>
        )}

        <DetailSection title="Notes">
          <Notes
            notes={shown.comments}
            canWrite={can.writeCards}
            canDelete={() => can.writeCards}
            onAdd={text => comment(shown.id, text, authorName)}
            onDelete={id => uncomment(shown.id, id)}
          />
        </DetailSection>
      </DetailViewer>

      {lightbox && (
        <LightboxModal
          open
          onOpenChange={open => !open && setLightbox(null)}
          src={lightbox.src}
          name={lightbox.name}
          video={lightbox.video}
        />
      )}
    </>
  );
}

function Stamp({ time, by }: { time: string; by?: string }) {
  const rel = relTime(time);
  return (
    <span className="mono flex flex-wrap items-center gap-1.5">
      {time || '-'}
      {rel && <span className="text-muted-foreground">· {rel}</span>}
      {by?.trim() && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          · by <PersonLine name={by.trim()} />
        </span>
      )}
    </span>
  );
}

interface HumanConfirmProps {
  label: string;
  title: string;
  description: string;
  onConfirm: () => void;
}

function HumanConfirm({ label, title, description, onConfirm }: HumanConfirmProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
