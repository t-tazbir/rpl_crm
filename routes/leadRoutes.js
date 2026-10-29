const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const leadContactController = require('../controllers/leadContactController');
const activityController = require('../controllers/activityController');
const auth = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

// Get all leads (Dynamic filter applied based on user role inside controller —
// leadController.getLeads needs a TEAM_LEAD branch added, see note to Tazbir).
router.get('/', auth, leadController.getLeads);

// Create a new lead
router.post('/', auth, leadController.createLead);

// Update an existing lead (ownership check is assertLeadAccess, which now
// understands TEAM_LEAD — see leadAccessService.js)
router.put('/:id', auth, leadController.updateLead);

// Transfer lead ownership — deliberately NOT opened to TEAM_LEAD. You didn't
// ask for Team Leads to be able to move leads between reps (including their
// own reports), only to view/edit — so this stays CLUSTER_HEAD/DD_ED only,
// same as before.
router.put('/:leadId/transfer', auth, authorize('DD_ED', 'CLUSTER_HEAD'), leadController.transferLead)

// --- Multi-phone contacts (up to 4, one primary, globally unique) ---
router.get('/:id/phones', auth, leadContactController.getPhones);
router.post('/:id/phones', auth, leadContactController.addPhone);
router.put('/:id/phones/:phoneId/primary', auth, leadContactController.setPrimaryPhone);
router.delete('/:id/phones/:phoneId', auth, leadContactController.deletePhone);

// --- Spouse info (DB-only, up to 2 numbers, globally unique) ---
router.put('/:id/spouse', auth, leadContactController.updateSpouseName);
router.post('/:id/spouse-phones', auth, leadContactController.addSpousePhone);
router.delete('/:id/spouse-phones/:phoneId', auth, leadContactController.deleteSpousePhone);

// --- Activity timeline (who nursed this lead, when, and how) ---
router.get('/:id/activities', auth, activityController.getActivities);
router.post('/:id/activities', auth, activityController.addActivity);

module.exports = router;
