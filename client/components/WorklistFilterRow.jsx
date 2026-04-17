// npmPackages/radiology-workflow/client/components/WorklistFilterRow.jsx

import React, { useState, useEffect, useRef } from 'react';
import {
  TableRow,
  TableCell,
  TextField,
  Select,
  MenuItem,
  FormControl
} from '@mui/material';

// =============================================================================
// WORKLIST FILTER ROW - Per-column text inputs and select dropdowns
// =============================================================================
//
// Renders a table row with filter controls (text inputs or select dropdowns)
// under each column header. Debounced 300ms for text inputs.
// =============================================================================

function WorklistFilterRow({ columns, filters, onFilterChange, hasExpandColumn }) {
  const [localFilters, setLocalFilters] = useState(filters || {});
  const debounceTimers = useRef({});

  useEffect(function() {
    setLocalFilters(filters || {});
  }, [filters]);

  function handleTextChange(key, value) {
    const updated = { ...localFilters, [key]: value };
    setLocalFilters(updated);

    // Debounce text input
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }
    debounceTimers.current[key] = setTimeout(function() {
      onFilterChange(updated);
    }, 300);
  }

  function handleSelectChange(key, value) {
    const updated = { ...localFilters, [key]: value };
    setLocalFilters(updated);
    onFilterChange(updated);
  }

  return (
    <TableRow sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1 } }}>
      {hasExpandColumn && <TableCell key="__expand_filter__" />}
      {columns.map(function(col) {
        if (!col.filterable) {
          return <TableCell key={col.key} />;
        }

        if (col.filterType === 'select') {
          return (
            <TableCell key={col.key}>
              <FormControl size="small" fullWidth variant="standard">
                <Select
                  value={localFilters[col.key] || ''}
                  onChange={function(e) {
                    handleSelectChange(col.key, e.target.value);
                  }}
                  displayEmpty
                  sx={{ fontSize: '0.75rem' }}
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  {(col.filterOptions || []).map(function(opt) {
                    return (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </TableCell>
          );
        }

        // Default: text filter
        return (
          <TableCell key={col.key}>
            <TextField
              size="small"
              variant="standard"
              placeholder="Filter..."
              value={localFilters[col.key] || ''}
              onChange={function(e) {
                handleTextChange(col.key, e.target.value);
              }}
              inputProps={{ style: { fontSize: '0.75rem', padding: '2px 0' } }}
              fullWidth
            />
          </TableCell>
        );
      })}
    </TableRow>
  );
}

export default WorklistFilterRow;
