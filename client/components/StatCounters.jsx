// npmPackages/radiology-workflow/client/components/StatCounters.jsx

import React from 'react';
import { Box, Typography, Badge } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// =============================================================================
// STAT COUNTERS - Summary badge counts for the header area
// =============================================================================
//
// Displays a row of count boxes showing STAT/priority/TAT threshold tallies.
// Each counter: { label: 'STAT', count: 3, color: 'error' }
// =============================================================================

function StatCounterBox({ label, count, color }) {
  const theme = useTheme();

  const bgColor = color && theme.palette[color]
    ? alpha(theme.palette[color].main, 0.12)
    : alpha(theme.palette.text.primary, 0.08);

  const textColor = color && theme.palette[color]
    ? theme.palette[color].main
    : theme.palette.text.primary;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: 1.5,
        py: 0.75,
        borderRadius: 1,
        backgroundColor: bgColor,
        minWidth: 56
      }}
    >
      <Typography
        variant="h6"
        sx={{ fontWeight: 700, lineHeight: 1.2, color: textColor }}
      >
        {count}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: textColor,
          fontSize: '0.6rem'
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function StatCounters({ counters }) {
  if (!counters || counters.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      {counters.map(function(counter, index) {
        return (
          <StatCounterBox
            key={index}
            label={counter.label}
            count={counter.count}
            color={counter.color}
          />
        );
      })}
    </Box>
  );
}

export default StatCounters;
