import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

import CodeBlock from '@/components/shared/CodeBlock';
import { MentionChip } from '@/components/shared/Mentions';
import { linkMentions, MENTION_HREF } from '@/lib/mentions';
import { useAuthStore } from '@/stores/useAuthStore';

export default function DetailMarkdown({ text }: { text: string }) {
  const members = useAuthStore(s => s.members);
  const linked = useMemo(() => linkMentions(text, members), [text, members]);

  if (!text.trim()) return <p className="text-[12px] text-muted-foreground">(none)</p>;
  return (
    <div className="flex min-w-0 flex-col gap-2 overflow-hidden text-[13px] break-words [&_code]:font-mono [&_li]:ml-4 [&_li]:list-disc [&_table]:block [&_table]:overflow-x-auto">
      <ReactMarkdown
        components={{
          a: ({ href, children, ...props }) =>
            href?.startsWith(MENTION_HREF) ? (
              <MentionChip userId={href.slice(MENTION_HREF.length)} label={String(children).replace(/^@/, '')} />
            ) : (
              <a href={href} {...props}>
                {children}
              </a>
            ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const body = String(children).replace(/\n$/, '');
            const language = /language-(\w+)/.exec(className ?? '')?.[1];
            if (!language && !body.includes('\n')) {
              return (
                <code className="rounded bg-muted px-1 py-0.5 text-[12px]" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock code={body} language={language} />;
          },
        }}
      >
        {linked}
      </ReactMarkdown>
    </div>
  );
}
