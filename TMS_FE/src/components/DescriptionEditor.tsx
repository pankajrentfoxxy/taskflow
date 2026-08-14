'use client';

import { useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { insertDescriptionLink, normalizeDescriptionUrl } from '@/lib/descriptionLinks';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Modal from '@/components/Modal';
import DescriptionContent from '@/components/DescriptionContent';
import { toast } from '@/lib/util';

type PendingLink = { name: string; url: string };

export default function DescriptionEditor({
  value,
  onChange,
  placeholder = 'Add a description…',
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [addedLinks, setAddedLinks] = useState<PendingLink[]>([]);

  const openLinkModal = () => {
    setLinkName('');
    setLinkUrl('');
    setAddedLinks([]);
    setLinkModalOpen(true);
  };

  const closeLinkModal = () => {
    setLinkModalOpen(false);
    setLinkName('');
    setLinkUrl('');
    setAddedLinks([]);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const insertLink = () => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const result = insertDescriptionLink(value, start, end, linkName, linkUrl);
    if (!result) {
      toast.error('Enter both name and link');
      return;
    }

    onChange(result.value);
    setAddedLinks((prev) => [...prev, { name: linkName.trim(), url: linkUrl.trim() }]);
    setLinkName('');
    setLinkUrl('');
    toast.success('Link inserted');

    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(result.cursor, result.cursor);
    });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[88px] resize-y pr-10"
          rows={rows}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          onClick={openLinkModal}
          title="Add hyperlink"
        >
          <Link2 className="size-4" />
        </Button>
      </div>

      {value.trim() && (
        <div className="rounded-lg border bg-muted/10 p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</div>
          <DescriptionContent text={value} />
        </div>
      )}

      <Modal open={linkModalOpen} onClose={closeLinkModal} title="Add hyperlinks">
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="desc-link-name">Name</Label>
              <Input
                id="desc-link-name"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="Display text"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('desc-link-url')?.focus();
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="desc-link-url">Link</Label>
              <Input
                id="desc-link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    insertLink();
                  }
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={insertLink}>
              Insert
            </Button>
            <Button type="button" variant="outline" onClick={closeLinkModal}>
              Done
            </Button>
          </div>

          {addedLinks.length > 0 && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Added in this session ({addedLinks.length})
              </div>
              <ul className="space-y-1.5 text-sm">
                {addedLinks.map((link, i) => (
                  <li key={`${link.name}-${link.url}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium text-primary underline underline-offset-2">
                      {link.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {normalizeDescriptionUrl(link.url)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Add more links above, then click Done when finished.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
