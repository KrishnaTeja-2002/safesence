'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Verified() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      try {
        localStorage.setItem('auth-token', token);
        router.replace('/dashboard');
      } catch {
        router.replace('/login?verified=success');
      }
    } else {
      router.replace('/login?verified=success');
    }
  }, [router, searchParams]);

  return null;
}


