import { useCallback, useEffect, useState } from 'react';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

// Shared list-page state: search, pagination, per-column filters, sort, reload.
export function useList(endpoint, extraParams = {}) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearchState] = useState('');
  const [filters, setFilters] = useState({}); // { columnParam: value }
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);

  const extraKey = JSON.stringify(extraParams);
  const filterKey = JSON.stringify(filters);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(endpoint, {
        params: {
          page,
          limit,
          search,
          ...(sortBy ? { sortBy, sortDir } : {}),
          ...JSON.parse(filterKey),
          ...JSON.parse(extraKey)
        }
      });
      setRows(response.data.data.rows);
      setTotalCount(response.data.data.totalCount);
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, limit, search, sortBy, sortDir, filterKey, extraKey, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setSearch = (value) => {
    setSearchState(value);
    setPage(1);
  };
  const setPageSize = (value) => {
    setLimit(value);
    setPage(1);
  };
  // Set (or clear, when value is '') a single column filter; resets to page 1.
  const setFilter = (param, value) => {
    setFilters((current) => {
      const next = { ...current };
      if (value === '' || value === null || value === undefined) delete next[param];
      else next[param] = value;
      return next;
    });
    setPage(1);
  };
  // Toggle sort on a field: asc → desc → cleared, cycling per header click.
  const setSort = (field) => {
    setPage(1);
    if (sortBy !== field) {
      setSortBy(field);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortBy('');
      setSortDir('desc');
    }
  };

  return {
    rows,
    totalCount,
    page,
    limit,
    search,
    filters,
    sortBy,
    sortDir,
    loading,
    load,
    setPage,
    setSearch,
    setPageSize,
    setFilter,
    setSort
  };
}
