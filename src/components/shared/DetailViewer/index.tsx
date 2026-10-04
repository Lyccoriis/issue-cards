import { useCallback, useEffect, useRef, type ReactNode } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export { default as DetailMarkdown } from './DetailMarkdown';
export { default as DetailSection } from './DetailSection';

interface DetailViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  eyebrow?: ReactNode;
  title: ReactNode;
  badges?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;

  width: number;
  onWidth: (width: number) => void;

  children: ReactNode;
}

export default function DetailViewer({
  open,
  onOpenChange,
  eyebrow,
  title,
  badges,
  subtitle,
  footer,
  width,
  onWidth,
  children,
}: DetailViewerProps) {
  const dragging = useRef(false);

  const onDrag = useCallback(
    (event: PointerEvent) => {
      if (!dragging.current) return;
      const next = window.innerWidth - event.clientX;
      onWidth(Math.min(Math.max(next, 420), Math.max(520, window.innerWidth - 220)));
    },
    [onWidth],
  );

  useEffect(() => {
    const stop = () => {
      dragging.current = false;
      document.body.style.removeProperty('cursor');
    };
    window.addEventListener('pointermove', onDrag);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', onDrag);
      window.removeEventListener('pointerup', stop);
    };
  }, [onDrag]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" style={{ width, maxWidth: '100vw' }} className="gap-0 sm:max-w-none">
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="resize the viewer"
          onPointerDown={event => {
            event.preventDefault();
            dragging.current = true;
            document.body.style.cursor = 'col-resize';
          }}
          className="absolute inset-y-0 left-0 z-20 w-1.5 cursor-col-resize bg-transparent transition-colors duration-150 hover:bg-primary/40"
        />

        <SheetHeader className="border-b border-border pr-12">
          {eyebrow && <div className="mono text-[11px] text-muted-foreground">{eyebrow}</div>}
          <SheetTitle className="text-[18px] leading-snug break-words">{title}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
          </SheetDescription>
          {subtitle && <div className="path break-all">{subtitle}</div>}
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex min-w-0 flex-col gap-5 p-4">{children}</div>
        </ScrollArea>

        {footer && (
          <SheetFooter className="flex-row flex-wrap gap-2 border-t border-border">{footer}</SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
