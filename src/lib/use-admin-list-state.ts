"use client";

import { useEffect, useMemo, useState } from "react";

type UseAdminListStateInput<TFilters extends Record<string, unknown>> = {
  query?: string;
  filters: TFilters;
  paging?: {
    page?: number;
    pageSize?: number;
  };
};

export function useAdminListState<TFilters extends Record<string, unknown>>(
  input: UseAdminListStateInput<TFilters>
) {
  const [q, setQ] = useState(input.query ?? "");
  const [debouncedQ, setDebouncedQ] = useState(input.query ?? "");
  const [filters, setFilters] = useState<TFilters>(input.filters);
  const [page, setPage] = useState(input.paging?.page ?? 1);
  const [pageSize, setPageSize] = useState(input.paging?.pageSize ?? 20);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  const query = useMemo(
    () => ({
      q: debouncedQ.trim(),
      filters,
      page,
      pageSize,
    }),
    [debouncedQ, filters, page, pageSize]
  );

  return {
    q,
    setQ,
    debouncedQ,
    filters,
    setFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    query,
  };
}

