import { useMemo, useState } from 'react';
import { Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import TagBadge from '@/components/shared/TagBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorText } from '@/lib/supabase';
import { findTag, sameTag, tagRows, tagVar } from '@/lib/tags';
import { useIssueStore } from '@/stores/useIssueStore';
import { adoptTag, deleteTag, useTags } from '@/stores/useTagStore';
import type { IssueCard, IssueTag } from '@/types';

import TagDialog from './TagDialog';

interface TagFilterProps {
  cards: IssueCard[];
}

export default function TagFilter({ cards }: TagFilterProps) {
  const active = useIssueStore(s => s.filters.tag);
  const toggleTag = useIssueStore(s => s.toggleTag);
  const setFilter = useIssueStore(s => s.setFilter);
  const tags = useTags();

  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IssueTag | null>(null);

  const rows = useMemo(() => tagRows(tags, cards), [tags, cards]);
  const isOn = (name: string) => active.some(t => sameTag(t, name));

  function openDialog(tag: IssueTag | null) {
    setMenuOpen(false);
    setEditing(tag);
    setDialogOpen(true);
  }

  async function edit(name: string) {
    try {
      const tag = findTag(tags, name) ?? (await adoptTag(name));
      if (tag) openDialog(tag);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function remove(name: string) {
    try {
      const tag = findTag(tags, name) ?? (await adoptTag(name));
      if (!tag) return;
      await deleteTag(tag.id);
      toast.success(`${tag.name} deleted`);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Tags size={15} strokeWidth={1.6} />
            Tags
            {active.length > 0 && (
              <span className="tnum text-[11px] text-muted-foreground">{active.length}</span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Filter by tag</DropdownMenuLabel>

          {rows.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-muted-foreground">
              No tags yet. Make the first one below.
            </p>
          ) : (
            <ScrollArea className="max-h-64">
              {rows.map(row => (
                  <DropdownMenuCheckboxItem
                    key={row.name}
                    checked={isOn(row.name)}
                    onSelect={e => e.preventDefault()}
                    onCheckedChange={() => toggleTag(row.name)}
                    className="group/tag pr-2"
                  >
                    <span className="dot mr-2" style={{ background: tagVar(row.color) }} />
                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
                    <span className="tnum text-[11px] text-muted-foreground">{row.count}</span>

                    <span className="ml-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/tag:opacity-100">
                      <span
                        role="button"
                        tabIndex={-1}
                        aria-label={`edit ${row.name}`}
                        className="cursor-pointer p-0.5 text-muted-foreground hover:text-foreground"
                        onClick={e => {
                          e.stopPropagation();
                          void edit(row.name);
                        }}
                      >
                        <Pencil size={13} strokeWidth={1.6} />
                      </span>
                      <span
                        role="button"
                        tabIndex={-1}
                        aria-label={`delete ${row.name}`}
                        className="cursor-pointer p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={e => {
                          e.stopPropagation();
                          void remove(row.name);
                        }}
                      >
                        <Trash2 size={13} strokeWidth={1.6} />
                      </span>
                    </span>
                  </DropdownMenuCheckboxItem>
              ))}
            </ScrollArea>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => openDialog(null)}>
            <Plus size={15} strokeWidth={1.6} />
            New tag
          </DropdownMenuItem>

          <DropdownMenuItem disabled={active.length === 0} onSelect={() => setFilter('tag', [])}>
            <X size={15} strokeWidth={1.6} />
            Clear tag filters
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {active.map(name => (
        <TagBadge key={name} tag={name} active onRemove={() => toggleTag(name)} />
      ))}

      <TagDialog open={dialogOpen} onOpenChange={setDialogOpen} tag={editing} />
    </div>
  );
}
