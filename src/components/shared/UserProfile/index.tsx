import { useAuthStore } from '@/stores/useAuthStore';
import { useUiStore } from '@/stores/useUiStore';
import PersonSummary from './PersonSummary';

export default function UserProfile() {
  const userId = useUiStore(s => s.profileUserId);
  const close = useUiStore(s => s.closeUserProfile);
  const member = useAuthStore(s => s.members.find(m => m.userId === userId) ?? null);

  if (!userId || !member) return null;

  return <PersonSummary member={member} onOpenChange={open => !open && close()} />;
}
