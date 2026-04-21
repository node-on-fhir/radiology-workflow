// npmPackages/radiology-workflow/client/PatientDirectoryFooterButtons.jsx

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import AssignmentIcon from '@mui/icons-material/Assignment';

const footerRoutes = [
  { label: 'Order Catalog', path: '/radiology/order-entry', icon: AssignmentIcon }
];

function PatientDirectoryFooterButtons() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      width: '100%'
    }}>
      {footerRoutes.map(function(route) {
        const isActive = location.pathname === route.path;
        const IconComponent = route.icon;

        return (
          <Button
            key={route.path}
            variant={isActive ? 'contained' : 'text'}
            color={isActive ? 'secondary' : 'inherit'}
            size="small"
            startIcon={<IconComponent />}
            onClick={function() { navigate(route.path); }}
            sx={{
              textTransform: 'none',
              minWidth: 0,
              px: 1.5,
              fontSize: '0.75rem'
            }}
          >
            {route.label}
          </Button>
        );
      })}
    </Box>
  );
}

export default PatientDirectoryFooterButtons;
