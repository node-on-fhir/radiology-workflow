// npmPackages/radiology-workflow/client/RadiologyHome.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { get } from 'lodash';
import moment from 'moment';
import {
  Container,
  Card,
  CardHeader,
  CardContent,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Grid,
  Button,
  Divider,
  Chip
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PeopleIcon from '@mui/icons-material/People';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import StorageIcon from '@mui/icons-material/Storage';
import FolderIcon from '@mui/icons-material/Folder';

import { useRadiologyRole } from './hooks/useRadiologyRole.js';

// =============================================================================
// RADIOLOGY DEPARTMENT DASHBOARD
// =============================================================================
//
// Entry point for the radiology workflow module.
// Displays department statistics, resource counts, and workflow navigation.
// Auto-refreshes every 30 seconds.
// =============================================================================

// -----------------------------------------------------------------------------
// STAT CARD COMPONENT
// -----------------------------------------------------------------------------

function StatCard({ label, value, icon, color, loading }) {
  return (
    <Grid item xs={6} sm={4} md={2.4}>
      <Card sx={{ textAlign: 'center', py: 2, height: '100%' }}>
        <Box sx={{ color: color || 'primary.main', mb: 1 }}>
          {icon}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
          {loading ? '—' : (value ?? 0)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Card>
    </Grid>
  );
}

// -----------------------------------------------------------------------------
// STATUS CARD COMPONENT
// -----------------------------------------------------------------------------

function StatusCard({ title, items, icon }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        avatar={icon}
        title={title}
        titleTypographyProps={{ variant: 'subtitle1' }}
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ pt: 0 }}>
        {items.map(function(item) {
          return (
            <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: item.color }} />
                <Typography variant="body2" sx={{ color: 'text.primary' }}>{item.label}</Typography>
              </Box>
              <Chip
                label={item.count ?? 0}
                size="small"
                sx={{
                  fontWeight: 'bold',
                  minWidth: 40,
                  bgcolor: 'background.default'
                }}
              />
            </Box>
          );
        })}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// MONTHLY TRENDS CARD COMPONENT
// -----------------------------------------------------------------------------

function MonthlyTrendsCard({ history, loading }) {
  if (loading || !history || history.length === 0) {
    return null;
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardHeader
        title="Monthly Statistics History"
        titleTypographyProps={{ variant: 'subtitle1' }}
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ display: 'flex', gap: 2, minWidth: 'max-content' }}>
            {history.map(function(report) {
              const periodStart = get(report, 'period.start', '');
              const monthLabel = periodStart ? moment(periodStart).format('MMM YYYY') : 'Unknown';

              // Extract totals from groups
              const ordersGroup = (report.group || []).find(g => get(g, 'code.text') === 'Orders');
              const readsGroup = (report.group || []).find(g => get(g, 'code.text') === 'Reads');

              const ordersTotal = (ordersGroup?.population || []).reduce((sum, p) => sum + (p.count || 0), 0);
              const readsTotal = (readsGroup?.population || []).reduce((sum, p) => sum + (p.count || 0), 0);

              return (
                <Card key={report._id} variant="outlined" sx={{ minWidth: 120, textAlign: 'center', p: 1 }}>
                  <Typography variant="caption" color="text.secondary">{monthLabel}</Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2">Orders: <strong>{ordersTotal}</strong></Typography>
                    <Typography variant="body2">Reads: <strong>{readsTotal}</strong></Typography>
                  </Box>
                </Card>
              );
            })}
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Monthly snapshots from MeasureReports
        </Typography>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

function RadiologyHome() {
  const navigate = useNavigate();
  const { role, isLoading: roleLoading, roleCode } = useRadiologyRole();

  // Statistics state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [monthlyHistory, setMonthlyHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [creatingReport, setCreatingReport] = useState(false);
  const [gridfsStats, setGridfsStats] = useState(null);
  const [gridfsLoading, setGridfsLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // Fetch Statistics
  // ---------------------------------------------------------------------------

  function fetchStats() {
    Meteor.call('radiology.getDepartmentStatistics', function(error, result) {
      if (error) {
        console.error('[RadiologyHome] Error fetching stats:', error);
      } else {
        setStats(result);
        setLastRefresh(moment());
      }
      setStatsLoading(false);
    });
  }

  function fetchMonthlyHistory() {
    Meteor.call('radiology.getMonthlyHistory', 6, function(error, result) {
      if (error) {
        console.error('[RadiologyHome] Error fetching history:', error);
      } else {
        setMonthlyHistory(result || []);
      }
      setHistoryLoading(false);
    });
  }

  function fetchGridFSStats() {
    Meteor.call('dicom.getGridFSStatus', function(error, result) {
      if (error) {
        console.error('[RadiologyHome] Error fetching GridFS stats:', error);
      } else {
        setGridfsStats(result);
      }
      setGridfsLoading(false);
    });
  }

  function handleManualRefresh() {
    setStatsLoading(true);
    fetchStats();
  }

  function handleCreateMeasureReport() {
    const now = moment();
    const year = now.year();
    const month = now.month() + 1;

    setCreatingReport(true);
    Meteor.call('radiology.generateMonthlyMeasureReport', year, month, function(error, result) {
      setCreatingReport(false);
      if (error) {
        console.error('[RadiologyHome] Error creating report:', error);
      } else {
        console.log('[RadiologyHome] Created MeasureReport:', result);
        fetchMonthlyHistory(); // Refresh to show new report
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Auto-refresh every 30 seconds
  // ---------------------------------------------------------------------------

  useEffect(function() {
    fetchStats();
    fetchMonthlyHistory();
    fetchGridFSStats();

    const interval = setInterval(function() {
      fetchStats();
      fetchGridFSStats();
    }, 30000);
    return function() {
      clearInterval(interval);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (roleLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Build status items for cards
  const orderStatusItems = [
    { label: 'Active', count: stats?.orders?.active, color: 'info.main' },
    { label: 'Completed', count: stats?.orders?.completed, color: 'success.main' },
    { label: 'On Hold', count: stats?.orders?.onHold, color: 'warning.main' },
    { label: 'Cancelled', count: stats?.orders?.cancelled, color: 'error.main' }
  ];

  const readStatusItems = [
    { label: 'Unread', count: stats?.reads?.unread, color: 'info.main' },
    { label: 'In Progress', count: stats?.reads?.inProgress, color: 'warning.main' },
    { label: 'Finalized', count: stats?.reads?.finalized, color: 'success.main' },
    { label: 'Cancelled', count: stats?.reads?.cancelled, color: 'error.main' }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }} id="radiologyHomePage">
      {/* Role Status Alert - commented out for now
      {role ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            You are logged in as: <strong>{role.toUpperCase()}</strong>
            {roleCode && ` (Role Code: ${roleCode})`}
          </Typography>
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            No radiology role assigned. Statistics are available but workflow actions may be limited.
          </Typography>
        </Alert>
      )}
      */}

      {/* Summary Statistics Row */}
      <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', mb: 2 }}>
        Department Overview
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <StatCard
          label="Patients"
          value={stats?.patients}
          icon={<PeopleIcon fontSize="large" />}
          color="primary.main"
          loading={statsLoading}
        />
        <StatCard
          label="Orders"
          value={stats?.orders?.total}
          icon={<AssignmentIcon fontSize="large" />}
          color="info.main"
          loading={statsLoading}
        />
        <StatCard
          label="Reads"
          value={stats?.reads?.total}
          icon={<VisibilityIcon fontSize="large" />}
          color="secondary.main"
          loading={statsLoading}
        />
        <StatCard
          label="Studies"
          value={stats?.imagingStudies}
          icon={<ImageIcon fontSize="large" />}
          color="warning.main"
          loading={statsLoading}
        />
        <StatCard
          label="Procedures"
          value={stats?.procedures}
          icon={<MedicalServicesIcon fontSize="large" />}
          color="success.main"
          loading={statsLoading}
        />
      </Grid>

      {/* DICOM Storage (GridFS) */}
      <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', mb: 2 }}>
        DICOM Storage
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <StatCard
          label="dicom.files"
          value={gridfsStats?.fileCount}
          icon={<FolderIcon fontSize="large" />}
          color="info.main"
          loading={gridfsLoading}
        />
        <StatCard
          label="dicom.chunks"
          value={gridfsStats?.chunkCount}
          icon={<StorageIcon fontSize="large" />}
          color="secondary.main"
          loading={gridfsLoading}
        />
        <StatCard
          label="Storage (MB)"
          value={gridfsStats?.totalSizeMB}
          icon={<StorageIcon fontSize="large" />}
          color="warning.main"
          loading={gridfsLoading}
        />
      </Grid>

      {gridfsStats && !gridfsStats.initialized && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          GridFS is not initialized. {gridfsStats.message || 'DICOM file storage is unavailable.'}
        </Alert>
      )}

      {/* Status Breakdown Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <StatusCard
            title="Order Status"
            items={orderStatusItems}
            icon={<AssignmentIcon color="primary" />}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <StatusCard
            title="Read Status"
            items={readStatusItems}
            icon={<VisibilityIcon color="secondary" />}
          />
        </Grid>
      </Grid>

      {/* Monthly History */}
      <MonthlyTrendsCard history={monthlyHistory} loading={historyLoading} />

      <Divider sx={{ my: 3 }} />

      {/* Workflow Phases */}
      <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
        Workflow Phases
      </Typography>

      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        Navigate to role-specific worklists:
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Phase 1: Order Entry */}
        <Grid item xs={12} md={3}>
          <Card
            sx={{
              height: '100%',
              cursor: 'pointer',
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: 6 },
              opacity: role === 'nurse' || !role ? 1 : 0.6
            }}
            onClick={() => navigate('/radiology/order-entry')}
          >
            <CardHeader
              avatar={<AssignmentIcon color="primary" />}
              title="Order Entry"
              titleTypographyProps={{ variant: 'subtitle1' }}
              subheader="Nursing"
              sx={{ pb: 0 }}
            />
            <CardContent>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Place imaging orders, select protocols, and review completed reports.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/radiology/order-entry');
                }}
              >
                Open Order Entry
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Phase 2-3: Safety & Acquisition */}
        <Grid item xs={12} md={3}>
          <Card
            sx={{
              height: '100%',
              cursor: 'pointer',
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: 6 },
              opacity: role === 'tech' || !role ? 1 : 0.6
            }}
            onClick={() => navigate('/radiology/tech')}
          >
            <CardHeader
              avatar={<MedicalServicesIcon color="secondary" />}
              title="Tech Worklist"
              titleTypographyProps={{ variant: 'subtitle1' }}
              subheader="Rad Tech"
              sx={{ pb: 0 }}
            />
            <CardContent>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Safety screening, image acquisition, and study completion.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/radiology/tech');
                }}
              >
                Open Tech Worklist
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Phase 4-7: Reading & Reporting */}
        <Grid item xs={12} md={3}>
          <Card
            sx={{
              height: '100%',
              cursor: 'pointer',
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: 6 },
              opacity: role === 'radiologist' || !role ? 1 : 0.6
            }}
            onClick={() => navigate('/radiology/reading')}
          >
            <CardHeader
              avatar={<VisibilityIcon color="error" />}
              title="Reading Worklist"
              titleTypographyProps={{ variant: 'subtitle1' }}
              subheader="Radiologist"
              sx={{ pb: 0 }}
            />
            <CardContent>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Interpret studies, document findings, and sign reports.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/radiology/reading');
                }}
              >
                Open Reading Worklist
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Phase 8: Reporting */}
        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              avatar={<DescriptionIcon color="success" />}
              title="Reporting"
              titleTypographyProps={{ variant: 'subtitle1' }}
              subheader="Administration"
              sx={{ pb: 0 }}
            />
            <CardContent>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Generate department statistics and monthly MeasureReports.
              </Typography>
              <Button
                variant="contained"
                color="success"
                size="small"
                fullWidth
                onClick={handleCreateMeasureReport}
                disabled={creatingReport}
              >
                {creatingReport ? 'Creating...' : 'Create Measure Report'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Quick Links */}
      <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
        Quick Links
      </Typography>

      <Grid container spacing={2}>
        <Grid item>
          <Button variant="text" onClick={() => navigate('/dicom/studies')}>
            DICOM Studies
          </Button>
        </Grid>
        <Grid item>
          <Button variant="text" onClick={() => navigate('/dicom/upload')}>
            Upload Images
          </Button>
        </Grid>
        <Grid item>
          <Button variant="text" onClick={() => navigate('/service-requests')}>
            All Orders
          </Button>
        </Grid>
        <Grid item>
          <Button variant="text" onClick={() => navigate('/diagnostic-reports')}>
            All Reports
          </Button>
        </Grid>
        <Grid item>
          <Button variant="text" onClick={() => navigate('/imaging-studies')}>
            All Studies
          </Button>
        </Grid>
        <Grid item>
          <Button variant="text" onClick={() => navigate('/measure-reports')}>
            Measure Reports
          </Button>
        </Grid>
      </Grid>

      {/* Package Info */}
      <Box
        sx={{
          mt: 4,
          pt: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Package: @node-on-fhir/radiology-workflow v0.1.0
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Auto-refresh: 30s
        </Typography>
      </Box>
    </Container>
  );
}

export default RadiologyHome;
