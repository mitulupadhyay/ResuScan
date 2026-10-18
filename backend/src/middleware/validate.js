const ApiError = require("../utils/ApiError");

const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      return next(
        ApiError.badRequest("Validation failed", result.error.issues),
      );
    }
    if (source === "query") {
      // Express 5: req.query is a read-only getter, so redefine it.
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } else {
      req[source] = result.data;
    }
    next();
  };

module.exports = { validate };