import { toast as sonner } from 'sonner';

export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

export const toast = {
  success(message: string) {
    sonner.success(message);
  },
  error(message: string) {
    sonner.error(message);
  },
  info(message: string) {
    sonner.info(message);
  },
  errorFrom(err: unknown, fallback?: string) {
    sonner.error(getErrorMessage(err, fallback));
  },
};

export const TASK_ACTION_TOAST: Record<string, string> = {
  acknowledge: 'Task acknowledged',
  start: 'Task started',
  done: 'Task marked done',
  block: 'Task marked blocked',
  unblock: 'Task unblocked',
  reopen: 'Task reopened',
  cancel: 'Task cancelled',
  update_eta: 'ETA updated',
};
