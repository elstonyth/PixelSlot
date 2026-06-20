'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-neutral-900 text-neutral-50">
        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <button
            onClick={() => reset()}
            className="rounded-lg bg-neutral-800 px-5 py-2.5 text-sm font-medium hover:bg-neutral-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
