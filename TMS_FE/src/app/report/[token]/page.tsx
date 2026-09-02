'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TaskFlowLogo from '@/components/TaskFlowLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiUrl } from '@/lib/util';
import { IconDownload } from '@/components/Icons';

type ReportInfo = {
  dateKey: string;
  taskCount: number | null;
  filename: string;
};

function formatReportDate(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function PublicReportPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [info, setInfo] = useState<ReportInfo | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setErr('Invalid report link');
      setLoading(false);
      return;
    }
    fetch(apiUrl(`/public/reports/${encodeURIComponent(token)}`))
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(data.error || 'Report not found'));
        setInfo(data as ReportInfo);
      })
      .catch((e: Error) => setErr(e.message || 'Report not found'))
      .finally(() => setLoading(false));
  }, [token]);

  const downloadHref = apiUrl(`/public/reports/${encodeURIComponent(token)}/download`);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      <div className="mb-8">
        <TaskFlowLogo />
      </div>
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Daily report</CardTitle>
          <CardDescription>TaskFlow Excel report download</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <p className="text-center text-sm text-muted-foreground animate-pulse">Loading report…</p>
          )}
          {!loading && err && (
            <p className="text-center text-sm text-destructive">{err}</p>
          )}
          {!loading && info && (
            <>
              <div className="rounded-lg border bg-background p-4 text-center space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Report date</p>
                <p className="text-lg font-bold">{formatReportDate(info.dateKey)}</p>
                {info.taskCount != null && (
                  <p className="text-sm text-muted-foreground">{info.taskCount} task{info.taskCount === 1 ? '' : 's'} assigned</p>
                )}
              </div>
              <Button asChild className="w-full h-11" size="lg">
                <a href={downloadHref} download={info.filename}>
                  <IconDownload className="w-4 h-4" />
                  Download Excel report
                </a>
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                This link is private. Do not share it publicly.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
