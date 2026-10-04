import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { highlight } from '@/lib/highlight';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const highlighted = useMemo(() => highlight(code, language), [code, language]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="group/code relative min-w-0">
      <Button
        variant="outline"
        size="icon-xs"
        aria-label="copy code"
        onClick={() => void copy()}
        className="absolute top-1.5 right-1.5 z-10 opacity-0 transition-opacity duration-150 group-hover/code:opacity-100 focus-visible:opacity-100"
      >
        {copied ? <Check size={15} strokeWidth={1.6} /> : <Copy size={15} strokeWidth={1.6} />}
      </Button>

      {language && (
        <span className="mono absolute top-2 left-2.5 text-[10px] text-muted-foreground">
          {language}
        </span>
      )}

      <pre className="codeblock max-w-full">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}
