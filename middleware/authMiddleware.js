const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // Bug #6 fix: token now lives in an HttpOnly cookie (set by authController.login),
    // not a header the frontend builds from localStorage. req.cookies requires the
    // `cookie-parser` middleware to be registered in server.js — see app.use(cookieParser()).
    //
    // The old `x-auth-token` / `Authorization` header path is intentionally removed:
    // keeping it as a "fallback" would let a page that still reads a token out of
    // localStorage (e.g. one we haven't migrated yet) continue authenticating that way,
    // which defeats the purpose of moving off localStorage in the first place.
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user; // attach the user payload to req object
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};