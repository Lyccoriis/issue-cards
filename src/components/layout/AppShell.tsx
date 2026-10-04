import NavSidebar from './NavSidebar';
import PanelHost from './PanelHost';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useLayoutStore } from '@/stores/useLayoutStore';

export default function AppShell() {
  const navMode = useLayoutStore(s => s.navSidebar.mode);
  const navWidth = useLayoutStore(s => s.navSidebar.width);
  const setNavSidebar = useLayoutStore(s => s.setNavSidebar);

  const navExpanded = navMode === 'expanded';

  return (
    <SidebarProvider
      open={navExpanded}
      onOpenChange={open => setNavSidebar({ mode: open ? 'expanded' : 'retracted' })}
      className="h-full min-h-0 w-full"
      style={{ '--sidebar-width': `${navWidth}px` } as React.CSSProperties}
    >
      <NavSidebar expanded={navExpanded} />

      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PanelHost />
      </SidebarInset>
    </SidebarProvider>
  );
}
