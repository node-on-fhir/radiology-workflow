// npmPackages/radiology-workflow/client.js

import React from 'react';
import RadiologyHome from './client/RadiologyHome.jsx';
import NursingDashboard from './client/NursingDashboard.jsx';
import OrderCatalogBrowser from './client/OrderCatalogBrowser.jsx';
import TechDashboard from './client/TechDashboard.jsx';
import ReadingDashboard from './client/ReadingDashboard.jsx';
import PatientViewFooterButtons from './client/PatientViewFooterButtons.jsx';
import RadiologyToolsFooterButtons from './client/RadiologyToolsFooterButtons.jsx';
import PacioExamRoomFooterButtons from './client/PacioExamRoomFooterButtons.jsx';
import PatientDirectoryFooterButtons from './client/PatientDirectoryFooterButtons.jsx';
import OrderHistoryFooterButtons from './client/OrderHistoryFooterButtons.jsx';
import workflowConfig from './workflow.json';

// =============================================================================
// DYNAMIC ROUTES
// =============================================================================

const DynamicRoutes = workflowConfig.routes.map(function(route) {
  let element = null;

  // Map component name to actual component
  switch (route.component) {
    case 'RadiologyHome':
      element = <RadiologyHome />;
      break;
    case 'NursingDashboard':
      element = <NursingDashboard />;
      break;
    case 'OrderCatalogBrowser':
      element = <OrderCatalogBrowser />;
      break;
    case 'TechDashboard':
      element = <TechDashboard />;
      break;
    case 'ReadingDashboard':
      element = <ReadingDashboard />;
      break;
    default:
      console.warn(`[radiology-workflow] Unknown component: ${route.component}`);
  }

  return {
    name: route.name,
    path: route.path,
    element: element,
    requireAuth: route.requireAuth || false,
    requireRole: route.requireRole || null
  };
});

// =============================================================================
// SIDEBAR WORKFLOWS
// =============================================================================

const SidebarWorkflows = workflowConfig.sidebarItems.map(function(item) {
  return {
    primaryText: item.primaryText,
    to: item.to,
    iconName: item.iconName,
    requireAuth: item.requireAuth || false,
    requireRole: item.requireRole || null
  };
});

// =============================================================================
// FOOTER BUTTONS
// =============================================================================

const FooterButtons = [
  {
    pathname: [
      '/patient-chart',
      '/international-patient-summary',
      '/fhir-graph',
      '/clinical-story',
      '/timeline-editor'
    ],
    element: <PatientViewFooterButtons />
  },
  {
    pathname: ['/radiology/tech', '/radiology/reading'],
    element: <RadiologyToolsFooterButtons />
  },
  {
    pathname: '/pacio-exam-room',
    element: <PacioExamRoomFooterButtons />
  },
  {
    pathname: '/patient-directory',
    element: <PatientDirectoryFooterButtons />
  },
  {
    pathname: '/radiology/order-history',
    element: <OrderHistoryFooterButtons />
  }
];

// =============================================================================
// EXPORTS
// =============================================================================

// Named exports (for direct import)
export {
  DynamicRoutes,
  SidebarWorkflows,
  FooterButtons,
  RadiologyHome,
  NursingDashboard,
  OrderCatalogBrowser,
  TechDashboard,
  ReadingDashboard,
  PatientViewFooterButtons,
  RadiologyToolsFooterButtons,
  PacioExamRoomFooterButtons,
  PatientDirectoryFooterButtons,
  OrderHistoryFooterButtons
};

// Default export (for WorkflowRegistry.registerWorkflow())
export default {
  name: workflowConfig.name,
  routes: DynamicRoutes,
  sidebarItems: SidebarWorkflows,
  footerButtons: FooterButtons
};
