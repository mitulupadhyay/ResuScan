const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: {
    error: { message: "Too many analyses - please wait a minute and retry." },
  },
});

// Uploads trigger an AI parse, so cap them per user.
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: { error: { message: "Too many uploads - please wait a minute and retry." } },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: {
    error: { message: "Too many auth attempts - please wait..." },
  },
});

module.exports = { analyzeLimiter, authLimiter, uploadLimiter };