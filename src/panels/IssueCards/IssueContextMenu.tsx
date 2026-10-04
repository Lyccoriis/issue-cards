import { useState, type ReactNode } from 'react';
import { CheckCheck, Plus, RotateCcw, Undo2, User } from 'lucide-react';
import { toast } from 'sonner';

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { errorText } from '@/lib/supabase';
import { cardHasTag, tagRows, tagVar } from '@/lib/tags';
import { usePermissions } from '@/stores/useAuthStore';
import { useIssueStore } from '@/stores/useIssueStore';
import { setCardTag, useTags } from '@/stores/useTagStore';
import { useUiStore } from '@/stores/useUiStore';
import type { IssueCard } from '@/types';
import { useAuthor } from './IssueBits';
import TagDialog from './TagDialog';

interface IssueContextMenuProps {
  card: IssueCard;
  onEdit?: (card: IssueCard) => void;
  children: ReactNode;
}

export default function IssueContextMenu({ card, onEdit, children }: IssueContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);

  async function setTag(name: string, on: boolean) {
    try {
      await setCardTag(card.id, name, on);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <ContextMenu onOpenChange={setOpen}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      {open && <MenuBody card={card} onEdit={onEdit} onNewTag={() => setTagDialogOpen(true)} />}

      {tagDialogOpen && (
        <TagDialog
          open
          onOpenChange={setTagDialogOpen}
          onCreated={tag => void setTag(tag.name, true)}
        />
      )}
    </ContextMenu>
  );
}

interface MenuBodyProps {
  card: IssueCard;
  onEdit?: (card: IssueCard) => void;
  onNewTag: () => void;
}

function MenuBody({ card, onEdit, onNewTag }: MenuBodyProps) {
  const select = useIssueStore(s => s.select);
  const checkedIds = useIssueStore(s => s.checkedIds);
  const toggleChecked = useIssueStore(s => s.toggleChecked);
  const cards = useIssueStore(s => s.cards);
  const setStatus = useIssueStore(s => s.setStatus);
  const toggleAuthor = useIssueStore(s => s.toggleAuthor);
  const authorFilter = useIssueStore(s => s.filters.author);
  const askFix = useUiStore(s => s.askFix);
  const askReject = useUiStore(s => s.askReject);
  const author = useAuthor(card);
  const can = usePermissions();
  const tags = useTags();

  const rows = tagRows(tags, cards);
  const closed = card.status === 'resolved' || card.status === 'wontfix';

  async function setTag(name: string, on: boolean) {
    try {
      await setCardTag(card.id, name, on);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function copy(text: string, done: string) {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  }

  async function reopen() {
    try {
      await setStatus(card.id, 'open');
      toast.success(`${card.id} reopened`);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <ContextMenuContent className="w-56">
      {can.writeCards && (
        <>
          <ContextMenuItem onSelect={onNewTag}>
            <Plus size={15} strokeWidth={1.6} />
            Create new tag
          </ContextMenuItem>

          <ContextMenuSeparator />
        </>
      )}

      <ContextMenuItem onSelect={() => select(card.id)}>Open</ContextMenuItem>
      {onEdit && <ContextMenuItem onSelect={() => onEdit(card)}>Edit</ContextMenuItem>}

      <ContextMenuSeparator />

      {can.writeCards && card.status !== 'fixed' && !closed && (
        <ContextMenuItem onSelect={() => askFix(card.id)}>
          <CheckCheck size={15} strokeWidth={1.6} />
          Mark fixed
        </ContextMenuItem>
      )}

      {can.writeCards && card.status === 'fixed' && (
        <ContextMenuItem variant="destructive" onSelect={() => askReject(card.id)}>
          <Undo2 size={15} strokeWidth={1.6} />
          Reject fix
        </ContextMenuItem>
      )}

      {can.writeCards && closed && (
        <ContextMenuItem onSelect={() => void reopen()}>
          <RotateCcw size={15} strokeWidth={1.6} />
          Reopen
        </ContextMenuItem>
      )}

      {author && (
        <ContextMenuCheckboxItem
          checked={authorFilter.includes(author.userId)}
          onCheckedChange={() => toggleAuthor(author.userId)}
        >
          <User size={15} strokeWidth={1.6} />
          Only {author.displayName}'s cards
        </ContextMenuCheckboxItem>
      )}

      <ContextMenuSeparator />

      <ContextMenuCheckboxItem
        checked={checkedIds.includes(card.id)}
        onCheckedChange={() => toggleChecked(card.id)}
      >
        {checkedIds.includes(card.id) ? 'Deselect' : 'Select'}
      </ContextMenuCheckboxItem>

      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={rows.length === 0 || !can.writeCards}>
          Tags
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="max-h-64 overflow-y-auto">
          {rows.map(row => (
            <ContextMenuCheckboxItem
              key={row.name}
              checked={cardHasTag(card, row.name)}
              onSelect={e => e.preventDefault()}
              onCheckedChange={on => void setTag(row.name, on)}
            >
              <span className="dot mr-2" style={{ background: tagVar(row.color) }} />
              {row.name}
            </ContextMenuCheckboxItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSeparator />

      <ContextMenuItem onSelect={() => void copy(card.id, 'ID copied')}>Copy ID</ContextMenuItem>
      <ContextMenuItem
        disabled={!card.location}
        onSelect={() => void copy(card.location, 'Location copied')}
      >
        Copy location
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
