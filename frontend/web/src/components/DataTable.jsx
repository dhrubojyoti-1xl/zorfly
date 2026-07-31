// QA-compliant data-table shell: search with clear icon, in-line column filters
// (in the toolbar, beside the search box), 10/20/50/100 page sizes, rows +
// totalCount from ONE response, consistent "No records found.", SR. No.
// numbering, optional per-column sort. Pages supply columns and row rendering;
// sort/filter state comes from the shared useList.
import { PAGE_SIZES } from '../utils/constants.js';
// Search + in-line column filters (toolbar) · sortable headers · pagination.

export default function DataTable({
  columns, // [{ key, label, className, sortKey?, filter?: { type:'select'|'text', param, options?, placeholder? } }]
  rows,
  totalCount,
  page,
  limit,
  loading,
  search,
  onSearch,
  onPage,
  onLimit,
  // Sort + filter state/handlers (supplied by useList via {...list}); optional.
  filters = {},
  sortBy = '',
  sortDir = 'desc',
  setSort,
  setFilter,
  renderRow // (row, serialNumber) => <tr>
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const canSort = typeof setSort === 'function';
  const canFilter = typeof setFilter === 'function';
  const filterColumns = canFilter ? columns.filter((column) => column.filter) : [];
  const activeFilters = canFilter && Object.keys(filters).length > 0;
  const clearAll = () => Object.keys(filters).forEach((param) => setFilter(param, ''));

  return (
    <>
      {filterColumns.length > 0 && (
        <div className="table-filter-bar">
          {filterColumns.map((column) =>
            column.filter.type === 'select' ? (
              <select
                key={column.key}
                className="table-filter"
                value={filters[column.filter.param] || ''}
                onChange={(event) => setFilter(column.filter.param, event.target.value)}
                aria-label={`Filter by ${column.label}`}
                title={`Filter by ${column.label}`}
              >
                <option value="">All {column.filter.label || column.label}</option>
                {column.filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                key={column.key}
                type="text"
                className="table-filter field-input"
                value={filters[column.filter.param] || ''}
                maxLength={80}
                placeholder={column.filter.placeholder || `Filter ${column.label}`}
                aria-label={`Filter by ${column.label}`}
                onChange={(event) => setFilter(column.filter.param, event.target.value)}
              />
            )
          )}
          {activeFilters && (
            <button
              type="button"
              className="btn btn-secondary btn-sm clear-filters-btn"
              onClick={clearAll}
              title="Clear all filters"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="card">
        <div className="table-toolbar">
          <div className="search-wrap">
            <input
              type="text"
              className="field-input search-input"
              placeholder="Search"
              value={search}
              maxLength={100}
              onChange={(event) => onSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                className="search-clear"
                aria-label="Clear search"
                title="Clear search"
                onClick={() => onSearch('')}
              >
                ✕
              </button>
            )}
          </div>
          <label className="page-size-label">
            Rows per page:{' '}
            <select
              className="page-size-select"
              value={limit}
              onChange={(event) => onLimit(Number(event.target.value))}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">SR. No.</th>
                {columns.map((column) => {
                  const sortable = canSort && column.sortKey;
                  const active = sortable && sortBy === column.sortKey;
                  return (
                    <th key={column.key} className={column.className || ''}>
                      {sortable ? (
                        <button
                          type="button"
                          className={`col-sort${active ? ' active' : ''}`}
                          onClick={() => setSort(column.sortKey)}
                          title={`Sort by ${column.label}`}
                        >
                          {column.label}
                          <span className="col-sort-arrow" aria-hidden="true">
                            {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="table-empty">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="table-empty">
                    No records found.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => renderRow(row, (page - 1) * limit + index + 1))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span className="table-count">
            {totalCount === 0
              ? '0 records'
              : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount} records`}
          </span>
          <div className="pager">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            >
              Previous
            </button>
            <span className="pager-info">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => onPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
