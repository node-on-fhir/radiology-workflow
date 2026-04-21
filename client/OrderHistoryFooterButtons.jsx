// npmPackages/radiology-workflow/client/OrderHistoryFooterButtons.jsx

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import MedicalServicesIcon from '@mui/icons-material/MedicalServices';

const footerRoutes = [
  { label: 'Radiology Worklist', path: '/radiology/tech', icon: MedicalServicesIcon }
];

function OrderHistoryFooterButtons() {
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

export default OrderHistoryFooterButtons;
