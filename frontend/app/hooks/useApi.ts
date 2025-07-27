'use client';

import { useState, useEffect } from 'react';
import { ApiResponse } from '../lib/api';

export function useApi<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiCall();

        if (response.error) {
          setError(response.error);
          setData(null);
        } else {
          setData(response.data || null);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, dependencies);

  const refetch = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall();

      if (response.error) {
        setError(response.error);
        setData(null);
      } else {
        setData(response.data || null);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch };
}
