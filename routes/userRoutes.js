const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const uploadProfilePicture = require('../middleware/uploadMiddleware');

router.get('/team', auth, userController.getTeamMembers);
router.get('/cluster-heads', auth, authorize('DD_ED'), userController.getClusterHeads);

// ── Team Lead management — CLUSTER_HEAD only, further scoped to their own
// cluster inside each controller function (see userController.js comments). ──
router.get('/my-cluster-members', auth, authorize('CLUSTER_HEAD'), userController.getMyClusterMembers);
router.post('/:id/make-team-lead', auth, authorize('CLUSTER_HEAD'), userController.makeTeamLead);
router.post('/:id/remove-team-lead', auth, authorize('CLUSTER_HEAD'), userController.removeTeamLead);
router.put('/:id/assign-team-lead', auth, authorize('CLUSTER_HEAD'), userController.assignTeamLead);

// --- Self-service profile (any authenticated user manages their own) ---
router.get('/me', auth, userController.getMyProfile);
router.put('/me', auth, userController.updateMyProfile);
router.put('/me/email', auth, userController.updateMyEmail);
router.post('/me/profile-picture', auth, uploadProfilePicture, userController.uploadProfilePicture);

module.exports = router;
