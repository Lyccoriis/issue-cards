import { useState } from 'react';
import { MessageSquarePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import UserIdentity from '@/components/shared/UserIdentity';
import MentionField from '@/components/shared/MentionField';
import RichText from '@/components/shared/Mentions';
import { Button } from '@/components/ui/button';
import { relTime } from '@/lib/relTime';
import { errorText } from '@/lib/supabase';

export interface NoteItem {
  id: string;
  time: string;
  author: string;
  authorId: string | null;
  text: string;
}

interface NotesProps {
  notes: NoteItem[];
  canWrite: boolean;
  canDelete: (note: NoteItem) => boolean;
  onAdd: (text: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  empty?: string;
}

export default function Notes({
  notes,
  canWrite,
  canDelete,
  onAdd,
  onDelete,
  empty = 'No notes yet.',
}: NotesProps) {
  const [text, setText] = useState('');

  async function run(work: () => Promise<unknown>, done: string) {
    try {
      await work();
      toast.success(done);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function add() {
    const value = text.trim();
    if (!value) return;
    setText('');
    await run(() => onAdd(value), 'Note added');
  }

  return (
    <div className="flex flex-col gap-2">
      {notes.map(note => (
        <div key={note.id} className="group rounded-md border border-border p-2.5">
          <div className="flex items-center gap-2">
            <div className="mono flex flex-1 items-center gap-1.5 text-[11px] text-muted-foreground">
              <UserIdentity userId={note.authorId} name={note.author} showName />
              · {note.time}
              {relTime(note.time) && ` · ${relTime(note.time)}`}
            </div>
            {canDelete(note) && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete note"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => void run(() => onDelete(note.id), 'Note deleted')}
              >
                <Trash2 size={15} strokeWidth={1.6} />
              </Button>
            )}
          </div>
          <RichText text={note.text} className="mt-1 text-[13px]" />
        </div>
      ))}

      {notes.length === 0 && <p className="text-[12px] text-muted-foreground">{empty}</p>}

      {canWrite && (
        <div className="flex gap-2">
          <MentionField
            value={text}
            placeholder="Add a note, @ to mention someone"
            onValueChange={setText}
            onKeyDown={e => {
              if (e.key === 'Enter') void add();
            }}
          />
          <Button variant="outline" size="sm" onClick={() => void add()}>
            <MessageSquarePlus size={15} strokeWidth={1.6} />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
