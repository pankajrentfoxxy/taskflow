'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className="max-h-[92vh] w-full max-w-lg gap-0 overflow-y-auto p-0 sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader className="sticky top-0 z-10 border-b bg-background px-5 py-3.5">
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
