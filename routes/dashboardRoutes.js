const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const auth = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

// Only Management (DD_ED) and Cluster Heads may view dashboard stats.
router.get('/stats', auth, authorize('DD_ED', 'CLUSTER_HEAD'), dashboardController.getDashboardStats);

// A Sales Rep's own dashboard — scoped to their own leads inside the controller.
// TEAM_LEAD added here so leads.html's Today's Follow-ups / Stale Leads / My
// Performance sections don't 403 for them. IMPORTANT CAVEAT (not yet fixed,
// flagging honestly): getSalesRepDashboard's query is not yet TEAM_LEAD-aware,
// so a Team Lead hitting this today will see stats for ONLY their own leads —
// not their reports'. That's a safe (non-leaking) degradation, not a security
// issue, but it means their dashboard undercounts until dashboardController.js
// gets a matching TEAM_LEAD branch (mirroring leadController.getLeads).
router.get('/my-stats', auth, authorize('SALES_MAN', 'TEAM_LEAD'), dashboardController.getSalesRepDashboard);

// Per-rep breakdown for a team — powers the Cluster Head portal's organogram + Team Analysis tab.
router.get('/team-breakdown', auth, authorize('DD_ED', 'CLUSTER_HEAD'), dashboardController.getTeamBreakdown);

// Company-wide 3-level organogram (DD/ED -> Cluster Heads -> Sales Men).
router.get('/org-chart', auth, authorize('DD_ED'), dashboardController.getCompanyOrgChart);

module.exports = router;
