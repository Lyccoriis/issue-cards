import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PanelShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  topbar?: ReactNode;
  scroll?: boolean;
  width?: number;
  children: ReactNode;
}

export default function PanelShell({
  title,
  description,
  actions,
  topbar,
  scroll = true,
  width = 1560,
  children,
}: PanelShellProps) {
  const column = { maxWidth: width > 0 ? width : 'none' };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <header className="flex-none border-b border-border py-3">
        <div className="mx-auto flex w-full items-center gap-3 px-[22px]" style={column}>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight">{title}</h1>
            {description && (
              <p className="truncate text-[12px] text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      </header>

      {topbar}

      {scroll ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="pad w-full" style={column}>{children}</div>
        </ScrollArea>
      ) : (
        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      )}
    </div>
  );
}
