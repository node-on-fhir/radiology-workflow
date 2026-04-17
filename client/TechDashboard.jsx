// npmPackages/radiology-workflow/client/TechDashboard.jsx

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { get } from 'lodash';
import {
  Container,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  TextField,
  Chip,
  Divider,
  Tabs,
  Tab,
  Stepper,
  Step,
  StepLabel,
  FormControlLabel,
  Checkbox,
  Paper,
  CardHeader,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack
} from '@mui/material';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import DensityMediumIcon from '@mui/icons-material/DensityMedium';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import UploadIcon from '@mui/icons-material/Upload';
import LaunchIcon from '@mui/icons-material/Launch';
import ImageIcon from '@mui/icons-material/Image';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PersonIcon from '@mui/icons-material/Person';
import CancelIcon from '@mui/icons-material/Cancel';

import WorklistTable from './components/WorklistTable.jsx';
import TatDisplay from './components/TatDisplay.jsx';
import StatCounters from './components/StatCounters.jsx';
import WorkflowDrawer from './components/WorkflowDrawer.jsx';
import { LaunchAppsModal } from '/imports/components/LaunchAppsModal.jsx';

// =============================================================================
// TECH DASHBOARD - SAFETY SCREENING & IMAGE ACQUISITION
// =============================================================================
//
// Phases 2-3 of radiology workflow:
// - View active imaging orders (worklist)
// - Complete safety screening (QuestionnaireResponse)
// - Start/complete imaging procedure
// - Create ImagingStudy
// =============================================================================

// Safety screening questions (simplified demo version)
const SAFETY_QUESTIONS = [
  { id: 'allergy', text: 'History of contrast allergy?', type: 'boolean' },
  { id: 'pregnancy', text: 'Pregnancy or possibility of pregnancy?', type: 'boolean' },
  { id: 'implant', text: 'Metallic implants (pacemaker, clips, etc.)?', type: 'boolean' },
  { id: 'kidney', text: 'History of kidney disease or dialysis?', type: 'boolean' },
  { id: 'claustrophobia', text: 'Claustrophobia (for MRI)?', type: 'boolean' },
  { id: 'diabetes', text: 'Diabetes with metformin use?', type: 'boolean' }
];

// Tab definitions
const TECH_TABS = [
  { label: 'Active Orders', filter: function(o) { return o.status === 'active'; } },
  { label: 'In Progress', filter: function(o) { return o.status === 'active' && o._hasInProgressProcedure; } },
  { label: 'On Hold', filter: function(o) { return o.status === 'on-hold'; } },
  { label: 'All', filter: function() { return true; } }
];

// Map display-text prefixes → DICOM modality codes
// Handles cases like MRA→MR and DEXA→DXA
var TEXT_PREFIX_TO_MODALITY = {
  'XR': 'XR', 'CT': 'CT', 'MR': 'MR', 'US': 'US',
  'NM': 'NM', 'MG': 'MG', 'RF': 'RF', 'XA': 'XA',
  'DXA': 'DXA', 'DEXA': 'DXA', 'MRA': 'MR'
};

// Extract DICOM modality code from ServiceRequest code.coding array
function getDicomModality(order, fallback) {
  // 1. Look for explicit DICOM coding entry (new orders)
  var codings = get(order, 'code.coding', []);
  var dicomCoding = codings.find(function(c) {
    return get(c, 'system') === 'http://dicom.nema.org/resources/ontology/DCM';
  });
  if (dicomCoding) {
    return get(dicomCoding, 'code', fallback || '');
  }

  // 2. Fallback: extract modality prefix from description text
  var text = get(order, 'code.text', '');
  var firstWord = text.split(' ')[0];
  if (firstWord && TEXT_PREFIX_TO_MODALITY[firstWord]) {
    return TEXT_PREFIX_TO_MODALITY[firstWord];
  }

  return fallback || '';
}

function getPriorityChipProps(priority) {
  const map = {
    'stat': { color: 'error', variant: 'filled' },
    'asap': { color: 'error', variant: 'outlined' },
    'urgent': { color: 'warning', variant: 'outlined' },
    'routine': { color: 'default', variant: 'outlined' }
  };
  return map[priority] || map['routine'];
}

function getStatusChipColor(status) {
  const map = {
    'active': 'info',
    'completed': 'success',
    'on-hold': 'warning',
    'revoked': 'default',
    'entered-in-error': 'default',
    'draft': 'default'
  };
  return map[status] || 'default';
}

function TechDashboard() {
  const navigate = useNavigate();

  const selectedPatient = useTracker(function() {
    return Session.get('selectedPatient');
  }, []);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [workflowStep, setWorkflowStep] = useState(0);
  const [screeningAnswers, setScreeningAnswers] = useState({});
  const [contraindications, setContraindications] = useState([]);
  const [acquisitionNotes, setAcquisitionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [currentProcedure, setCurrentProcedure] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [density, setDensity] = useState('standard');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [launchPatient, setLaunchPatient] = useState(null);

  // ---------------------------------------------------------------------------
  // Data subscriptions
  // ---------------------------------------------------------------------------
  const {
    orders,
    procedures,
    isLoading
  } = useTracker(function() {
    const ordersHandle = Meteor.subscribe('radiology.ServiceRequests', {
      'category.coding.code': '363679005'
    }, { limit: 200 });

    const proceduresHandle = Meteor.subscribe('autopublish.Procedures', {
      status: 'in-progress'
    }, { limit: 50 });

    const ServiceRequests = Meteor.Collections?.ServiceRequests;
    const Procedures = Meteor.Collections?.Procedures;

    let activeOrders = [];
    let activeProcedures = [];

    if (ServiceRequests) {
      activeOrders = ServiceRequests.find({
        'category.coding.code': '363679005'
      }).fetch();

      // Custom priority sort
      const priorityOrder = { 'stat': 0, 'asap': 1, 'urgent': 2, 'routine': 3 };
      activeOrders.sort(function(a, b) {
        const aPriority = priorityOrder[a.priority] ?? 3;
        const bPriority = priorityOrder[b.priority] ?? 3;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return new Date(a.authoredOn) - new Date(b.authoredOn);
      });
    }

    if (Procedures) {
      activeProcedures = Procedures.find({
        status: 'in-progress'
      }).fetch();
    }

    return {
      orders: activeOrders,
      procedures: activeProcedures,
      isLoading: !ordersHandle.ready()
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Flatten orders + annotate with procedure status
  // ---------------------------------------------------------------------------
  const flattenedOrders = useMemo(function() {
    const procedureOrderIds = new Set();
    procedures.forEach(function(proc) {
      const basedOn = get(proc, 'basedOn.0.reference', '');
      const orderId = basedOn.replace('ServiceRequest/', '');
      if (orderId) procedureOrderIds.add(orderId);
    });

    return orders.map(function(order) {
      return {
        _id: get(order, '_id', ''),
        id: get(order, 'id', ''),
        status: get(order, 'status', ''),
        priority: get(order, 'priority', 'routine'),
        description: get(order, 'code.text', get(order, 'code.coding.0.display', '')),
        modality: getDicomModality(order),
        bodySite: get(order, 'bodySite.0.text', get(order, 'bodySite.0.coding.0.display', '')),
        patientDisplay: get(order, 'subject.display', get(order, 'subject.reference', '').replace('Patient/', '')),
        authoredOn: get(order, 'authoredOn', ''),
        barcode: get(order, '_id', ''),
        reasonCode: get(order, 'reasonCode.0.text', get(order, 'reasonCode.0.coding.0.display', '')),
        _hasInProgressProcedure: procedureOrderIds.has(order._id),
        _raw: order
      };
    });
  }, [orders, procedures]);

  // ---------------------------------------------------------------------------
  // Tab-filtered data
  // ---------------------------------------------------------------------------
  const tabFilteredData = useMemo(function() {
    const tabDef = TECH_TABS[activeTab];
    if (!tabDef) return flattenedOrders;
    return flattenedOrders.filter(tabDef.filter);
  }, [flattenedOrders, activeTab]);

  // ---------------------------------------------------------------------------
  // STAT counters
  // ---------------------------------------------------------------------------
  const statCounters = useMemo(function() {
    let statCount = 0;
    let urgentCount = 0;
    let over4h = 0;
    const now = Date.now();

    flattenedOrders.forEach(function(order) {
      if (order.priority === 'stat' || order.priority === 'asap') statCount++;
      if (order.priority === 'urgent') urgentCount++;
      if (order.authoredOn) {
        const elapsed = now - new Date(order.authoredOn).getTime();
        if (elapsed > 4 * 3600000) over4h++;
      }
    });

    return [
      { label: 'STAT', count: statCount, color: 'error' },
      { label: 'Urgent', count: urgentCount, color: 'warning' },
      { label: '>4h TAT', count: over4h, color: 'error' },
      { label: 'Total', count: flattenedOrders.length, color: undefined }
    ];
  }, [flattenedOrders]);

  // ---------------------------------------------------------------------------
  // Column definitions
  // ---------------------------------------------------------------------------
  const techColumns = [
    {
      key: 'tat',
      label: 'TAT',
      width: 120,
      render: function(val, row) {
        return <TatDisplay startTime={row.authoredOn} size="small" disabled={row.status === 'revoked' || row.status === 'entered-in-error' || row.status === 'completed'} />;
      }
    },
    {
      key: 'priority',
      label: 'Priority',
      width: 100,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'stat', label: 'STAT' },
        { value: 'asap', label: 'ASAP' },
        { value: 'urgent', label: 'URGENT' },
        { value: 'routine', label: 'ROUTINE' }
      ],
      render: function(val) {
        return (
          <Chip
            label={(val || 'routine').toUpperCase()}
            size="small"
            {...getPriorityChipProps(val)}
          />
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      width: 100,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'active', label: 'Active' },
        { value: 'on-hold', label: 'On Hold' },
        { value: 'completed', label: 'Completed' }
      ],
      render: function(val) {
        return (
          <Chip
            label={val || 'unknown'}
            size="small"
            color={getStatusChipColor(val)}
            variant="outlined"
          />
        );
      }
    },
    {
      key: 'description',
      label: 'Description',
      filterable: true,
      filterType: 'text'
    },
    {
      key: 'modality',
      label: 'Mod',
      width: 70,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'CR', label: 'CR' },
        { value: 'CT', label: 'CT' },
        { value: 'MR', label: 'MR' },
        { value: 'US', label: 'US' },
        { value: 'XA', label: 'XA' },
        { value: 'NM', label: 'NM' },
        { value: 'PT', label: 'PET' },
        { value: 'MG', label: 'MG' }
      ]
    },
    {
      key: 'bodySite',
      label: 'Body Part',
      filterable: true,
      filterType: 'text'
    },
    {
      key: 'patientDisplay',
      label: 'Patient',
      filterable: true,
      filterType: 'text',
      render: function(val, row) {
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Select patient">
              <IconButton
                size="small"
                onClick={function(e) { handleSelectPatient(e, row); }}
                sx={{ p: 0.25 }}
              >
                <PersonIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
              </IconButton>
            </Tooltip>
            <span>{val || '-'}</span>
          </Box>
        );
      }
    },
    {
      key: 'authoredOn',
      label: 'Order Date',
      width: 140,
      sortable: true,
      render: function(val) {
        if (!val) return '-';
        return new Date(val).toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
      }
    },
    {
      key: 'barcode',
      label: 'Accession#',
      width: 100,
      render: function(val) {
        return (
          <Typography
            variant="caption"
            sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
          >
            {val ? val.substring(0, 12) : '-'}
          </Typography>
        );
      }
    }
  ];

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------
  function handleSelectPatient(event, row) {
    event.stopPropagation();

    const rawOrder = row._raw;
    const patientReference = get(rawOrder, 'subject.reference', '');
    const patientDisplay = get(rawOrder, 'subject.display', '');
    const patientId = patientReference.replace('Patient/', '');

    if (patientId) {
      Meteor.call('patients.findOne', patientId, function(err, patient) {
        if (patient) {
          Session.set('selectedPatient', patient);
          Session.set('selectedPatientId', get(patient, 'id', patientId));
        } else {
          Session.set('selectedPatientId', patientId);
          Session.set('selectedPatient', {
            id: patientId,
            reference: patientReference,
            display: patientDisplay
          });
        }
      });
    }
  }

  function handleSelectOrder(order) {
    setSelectedOrder(order);
    setWorkflowStep(0);
    setScreeningAnswers({});
    setContraindications([]);
    setCurrentProcedure(null);
    setError(null);
  }

  function evaluateScreening() {
    const issues = [];

    if (screeningAnswers.allergy) {
      issues.push('Contrast allergy - requires pre-medication protocol');
    }
    if (screeningAnswers.pregnancy) {
      issues.push('Pregnancy - requires radiologist review');
    }
    if (screeningAnswers.implant) {
      const modality = getDicomModality(selectedOrder);
      if (modality === 'MR') {
        issues.push('Metallic implant - MRI contraindicated');
      } else {
        issues.push('Metallic implant - verify MRI safety');
      }
    }
    if (screeningAnswers.kidney) {
      issues.push('Renal disease - contrast nephropathy risk');
    }
    if (screeningAnswers.claustrophobia) {
      issues.push('Claustrophobia - may require sedation');
    }
    if (screeningAnswers.diabetes) {
      issues.push('Metformin - hold 48h post-contrast');
    }

    setContraindications(issues);
    return issues;
  }

  async function handleCompleteScreening() {
    if (!selectedOrder) return;

    setSubmitting(true);
    setError(null);

    try {
      const patientId = get(selectedOrder, 'subject.reference', '').replace('Patient/', '');

      const items = SAFETY_QUESTIONS.map(function(q) {
        return {
          linkId: q.id,
          text: q.text,
          answer: [{ valueBoolean: !!screeningAnswers[q.id] }]
        };
      });

      await Meteor.callAsync('radiology.submitSafetyScreening', {
        questionnaireId: 'pre-imaging-safety',
        serviceRequestId: selectedOrder._id,
        patientId: patientId,
        items: items
      });

      const issues = evaluateScreening();

      if (issues.length > 0) {
        setError('Contraindications detected: ' + issues.join(', ') + '. Review before proceeding.');
      }

      setWorkflowStep(1);
    } catch (err) {
      console.error('[TechDashboard] Error submitting screening:', err);
      setError(err.reason || err.message || 'Failed to submit screening');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartProcedure() {
    if (!selectedOrder) return;

    setSubmitting(true);
    setError(null);

    try {
      const patientId = get(selectedOrder, 'subject.reference', '').replace('Patient/', '');
      const encounterId = get(selectedOrder, 'encounter.reference', '').replace('Encounter/', '');
      const modality = getDicomModality(selectedOrder, 'Unknown');
      const modalityDisplay = get(selectedOrder, 'code.text', modality);

      const procedureId = await Meteor.callAsync('radiology.startProcedure', {
        serviceRequestId: selectedOrder._id,
        patientId: patientId,
        encounterId: encounterId || undefined,
        modality: modality,
        modalityDisplay: modalityDisplay
      });

      console.log('[TechDashboard] Started procedure:', procedureId);
      setCurrentProcedure({ _id: procedureId });
    } catch (err) {
      console.error('[TechDashboard] Error starting procedure:', err);
      setError(err.reason || err.message || 'Failed to start procedure');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteProcedure() {
    if (!selectedOrder || !currentProcedure) return;

    setSubmitting(true);
    setError(null);

    try {
      const patientId = get(selectedOrder, 'subject.reference', '').replace('Patient/', '');
      const encounterId = get(selectedOrder, 'encounter.reference', '').replace('Encounter/', '');
      const modality = getDicomModality(selectedOrder, 'Unknown');

      const result = await Meteor.callAsync('radiology.completeProcedure', {
        procedureId: currentProcedure._id,
        serviceRequestId: selectedOrder._id,
        patientId: patientId,
        encounterId: encounterId || undefined,
        modality: modality,
        description: acquisitionNotes || (modality + ' imaging study'),
        numberOfSeries: 1,
        numberOfInstances: 1
      });

      console.log('[TechDashboard] Completed procedure:', result);
      setWorkflowStep(2);
    } catch (err) {
      console.error('[TechDashboard] Error completing procedure:', err);
      setError(err.reason || err.message || 'Failed to complete procedure');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelServiceRequest() {
    if (!selectedOrder) return;
    setSubmitting(true);
    setError(null);
    try {
      await Meteor.callAsync('radiology.cancelServiceRequest', {
        serviceRequestId: selectedOrder._id
      });
      console.log('[TechDashboard] Cancelled service request:', selectedOrder._id);
      setShowCancelDialog(false);
      setSelectedOrder(null);
    } catch (err) {
      console.error('[TechDashboard] Error cancelling service request:', err);
      setError(err.reason || err.message || 'Failed to cancel service request');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRefresh() {
    // Force resubscription by triggering a reactive change
    setActiveTab(function(prev) { return prev; });
  }

  // ---------------------------------------------------------------------------
  // Expanded row content (accordion buttons)
  // ---------------------------------------------------------------------------
  function renderExpandedContent(row) {
    var rawOrder = row._raw;
    var patientRef = get(rawOrder, 'subject.reference', '');
    var patientId = patientRef.replace('Patient/', '');

    return (
      <Stack direction="row" spacing={2} flexWrap="wrap">
        <Button variant="outlined" size="small" startIcon={<MonitorHeartIcon />}
          onClick={function(e) {
            e.stopPropagation();
            if (patientId) {
              Meteor.call('patients.findOne', patientId, function(err, patient) {
                if (patient) {
                  Session.set('selectedPatient', patient);
                  Session.set('selectedPatientId', get(patient, 'id', patientId));
                }
                navigate('/patient-chart');
              });
            }
          }}
        >
          Chart
        </Button>

        <Button variant="outlined" size="small" startIcon={<ImageIcon />}
          onClick={function(e) {
            e.stopPropagation();
            navigate('/dicom/upload?patient=' + encodeURIComponent(patientId)
              + '&servicerequest=' + encodeURIComponent(get(row, '_id', '')));
          }}
        >
          Images
        </Button>

        <Button variant="outlined" size="small" startIcon={<LaunchIcon />}
          onClick={function(e) {
            e.stopPropagation();
            if (patientId) {
              Meteor.call('patients.findOne', patientId, function(err, patient) {
                if (patient) {
                  setLaunchPatient(patient);
                } else {
                  // patients.findOne looks up by _id; the reference may contain
                  // a FHIR id instead. Fall back to a minimal patient object so
                  // the modal can still open.
                  console.warn('[TechDashboard] patients.findOne returned null for', patientId, '- using fallback');
                  setLaunchPatient({
                    _id: patientId,
                    id: patientId,
                    name: get(rawOrder, 'subject.display', '')
                  });
                }
                setLaunchModalOpen(true);
              });
            }
          }}
        >
          Launch
        </Button>

        <Button variant="contained" size="small" color="primary" startIcon={<PlayArrowIcon />}
          onClick={function(e) {
            e.stopPropagation();
            handleSelectOrder(rawOrder);
          }}
        >
          Start Workflow
        </Button>
      </Stack>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Box
      id="techDashboardPage"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: selectedPatient ? 'calc(100vh - 192px)' : 'calc(100vh - 128px)',
        transition: 'height 0.3s ease-in-out',
        overflow: 'hidden'
      }}
    >
      {/* Header bar */}
      <CardHeader
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          py: 1,
          px: 2
        }}
        avatar={<MedicalServicesIcon color="secondary" />}
        title="Tech Worklist"
        titleTypographyProps={{ variant: 'h6', sx: { fontWeight: 600 } }}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StatCounters counters={statCounters} />
            <Tooltip title={density === 'compact' ? 'Standard density' : 'Compact density'}>
              <IconButton
                size="small"
                onClick={function() { setDensity(density === 'compact' ? 'standard' : 'compact'); }}
              >
                {density === 'compact' ? <DensityMediumIcon fontSize="small" /> : <DensitySmallIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        }
      />

      {error && (
        <Alert severity="warning" sx={{ mx: 2, mt: 1, flexShrink: 0 }} onClose={function() { setError(null); }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={function(e, v) { setActiveTab(v); }}
        sx={{
          minHeight: density === 'compact' ? 36 : 48,
          borderBottom: 1,
          borderColor: 'divider',
          px: 2,
          flexShrink: 0,
          '& .MuiTab-root': {
            minHeight: density === 'compact' ? 36 : 48,
            py: density === 'compact' ? 0 : 1,
            textTransform: 'none',
            fontSize: density === 'compact' ? '0.8rem' : '0.875rem'
          }
        }}
      >
        {TECH_TABS.map(function(tab, i) {
          return <Tab key={i} label={tab.label} />;
        })}
      </Tabs>

      {/* Worklist table */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          p: density === 'standard' ? 1.5 : 0,
          mr: selectedOrder ? { xs: 0, sm: '480px' } : 0,
          transition: 'margin-right 225ms cubic-bezier(0, 0, 0.2, 1)'
        }}
      >
        <WorklistTable
          columns={techColumns}
          data={tabFilteredData}
          isLoading={isLoading}
          emptyMessage="No imaging orders found"
          selectedRowId={selectedOrder?._id}
          onRowClick={function(row) { handleSelectOrder(row._raw); }}
          onRefresh={handleRefresh}
          highlightRow={function(row) {
            return row.priority === 'stat' || row.priority === 'asap';
          }}
          density={density}
          renderExpandedContent={renderExpandedContent}
        />
      </Box>

      {/* Workflow Drawer */}
      <WorkflowDrawer
        open={!!selectedOrder}
        onClose={function() { setSelectedOrder(null); }}
        title={get(selectedOrder, 'code.text', 'Imaging Order')}
        subtitle={'Patient: ' + get(selectedOrder, 'subject.display', 'Unknown')}
      >
        {selectedOrder && (
          <Box>
            {/* Workflow Stepper */}
            <Stepper activeStep={workflowStep} sx={{ mb: 3 }}>
              <Step>
                <StepLabel>Safety Screening</StepLabel>
              </Step>
              <Step>
                <StepLabel>Image Acquisition</StepLabel>
              </Step>
              <Step>
                <StepLabel>Complete</StepLabel>
              </Step>
            </Stepper>

            {/* Step 0: Safety Screening */}
            {workflowStep === 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Pre-Imaging Safety Screening
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  {SAFETY_QUESTIONS.map(function(question) {
                    return (
                      <FormControlLabel
                        key={question.id}
                        control={
                          <Checkbox
                            size="small"
                            checked={!!screeningAnswers[question.id]}
                            onChange={function(e) {
                              setScreeningAnswers({
                                ...screeningAnswers,
                                [question.id]: e.target.checked
                              });
                            }}
                          />
                        }
                        label={
                          <Typography variant="body2">{question.text}</Typography>
                        }
                        sx={{ display: 'block', mb: 0.5 }}
                      />
                    );
                  })}
                </Paper>

                {contraindications.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
                    <Typography variant="subtitle2">Contraindications Detected:</Typography>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {contraindications.map(function(c, i) {
                        return <li key={i}><Typography variant="body2">{c}</Typography></li>;
                      })}
                    </ul>
                  </Alert>
                )}

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleCompleteScreening}
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={18} /> : <CheckCircleIcon />}
                >
                  Complete Screening
                </Button>
              </Box>
            )}

            {/* Step 1: Image Acquisition */}
            {workflowStep === 1 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Image Acquisition
                </Typography>

                {!currentProcedure ? (
                  <Box>
                    <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                      Click "Start Procedure" when ready to begin imaging.
                    </Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      onClick={handleStartProcedure}
                      disabled={submitting}
                      startIcon={submitting ? <CircularProgress size={18} /> : <PlayArrowIcon />}
                    >
                      Start Procedure
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Procedure in progress. Acquire images and then complete.
                    </Alert>

                    <TextField
                      label="Acquisition Notes"
                      placeholder="Any notes about the acquisition..."
                      value={acquisitionNotes}
                      onChange={function(e) { setAcquisitionNotes(e.target.value); }}
                      multiline
                      rows={2}
                      fullWidth
                      size="small"
                      sx={{ mb: 2 }}
                    />

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={function() {
                          const patientRef = get(selectedOrder, 'subject.reference', '');
                          const patientId = patientRef.replace('Patient/', '');
                          const serviceRequestId = get(selectedOrder, '_id', '');
                          navigate('/dicom/upload?patient=' + encodeURIComponent(patientId) + '&servicerequest=' + encodeURIComponent(serviceRequestId));
                        }}
                        startIcon={<UploadIcon />}
                      >
                        Upload Images
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        fullWidth
                        onClick={handleCompleteProcedure}
                        disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={18} /> : <CheckCircleIcon />}
                      >
                        Complete Procedure
                      </Button>
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {/* Step 2: Complete */}
            {workflowStep === 2 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Procedure Complete
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  Images are now available for radiologist review.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={function() { setSelectedOrder(null); }}
                  >
                    Return to Worklist
                  </Button>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={function() { navigate('/dicom/studies'); }}
                  >
                    View Studies
                  </Button>
                </Box>
              </Box>
            )}

            {/* Cancel — sticky at bottom of scroll area */}
            <Box sx={{
              position: 'sticky',
              bottom: -16,
              mx: -2,
              px: 2,
              py: 2,
              mt: 2,
              backgroundColor: 'background.paper',
              borderTop: 1,
              borderColor: 'divider'
            }}>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={function() { setShowCancelDialog(true); }}
                startIcon={<CancelIcon />}
              >
                Cancel Service Request
              </Button>
            </Box>
          </Box>
        )}
      </WorkflowDrawer>

      <Dialog
        open={showCancelDialog}
        onClose={function() { setShowCancelDialog(false); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Cancel Service Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to cancel this imaging order? This will set
            the status to "revoked" and cannot be easily undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={function() { setShowCancelDialog(false); }}>
            No, Keep Order
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancelServiceRequest}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} /> : <CancelIcon />}
          >
            Yes, Cancel Order
          </Button>
        </DialogActions>
      </Dialog>

      <LaunchAppsModal
        open={launchModalOpen}
        onClose={function() { setLaunchModalOpen(false); }}
        patient={launchPatient}
      />
    </Box>
  );
}

export default TechDashboard;
