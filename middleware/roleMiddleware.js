// middleware/roleMiddleware.js
//
// Role-based authorization gate. Must always run AFTER authMiddleware,
// since it depends on req.user (decoded from the JWT) being set already.
//
// Usage:
//   router.get('/stats', auth, authorize('DD_ED'), controller.someFn);
//   router.get('/stats', auth, authorize('DD_ED', 'CLUSTER_HEAD'), controller.someFn);
//
// This is the layer that was MISSING for dashboardRoutes.js — authMiddleware
// only proves "this is a logged-in user with a valid token", it says nothing
// about WHICH role that user has. Route-level role checks are the only
// reliable enforcement point; anything done in the browser (hiding buttons,
// redirecting on page load, etc.) is a UX nicety, not security, because a
// user can always call the API directly with their own valid token.

module.exports = function authorize(...allowedRoles) {
    return function (req, res, next) {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'Access Denied: Apnar ei resource access korar permission nei.'
            });
        }
        next();
    };
};
