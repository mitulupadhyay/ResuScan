const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const required = ["MONGO_URI", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// Models Google has retired for new API users. If an old .env still names one,
// fall back to the current default instead of failing every request.
const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const RETIRED_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
let geminiModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
if (RETIRED_GEMINI_MODELS.includes(geminiModel)) {
  console.warn(
    `GEMINI_MODEL=${geminiModel} is retired - using ${DEFAULT_GEMINI_MODEL}. Update your .env.`
  );
  geminiModel = DEFAULT_GEMINI_MODEL;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  cookieName: process.env.COOKIE_NAME || "arr_token",
  clientOrigins: (
    process.env.CLIENT_ORIGIN || "http://localhost:5173,http://localhost:5174"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel,
  isProd: process.env.NODE_ENV === "production",
};