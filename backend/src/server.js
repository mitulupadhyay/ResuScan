const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const env = require("./config/env");
const { connectDB } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const healthRouter = require("./routes/health");
const authRouter = require("./routes/auth");
const resumeRouter = require("./routes/resume");
const jobMatchRouter = require("./routes/jobMatch");
const improveRouter = require("./routes/improve");

const dashboardRouter = require("./routes/dashboard");
const insightsRouter = require("./routes/insights");
const versionsRouter = require("./routes/version");
const historyRouter = require("./routes/history");

const dashboardRouter = require("./routes/dashboard");
const insightsRouter = require("./routes/insights");
const versionsRouter = require("./routes/version");
const historyRouter = require("./routes/history");

const app = express();

app.set("trust proxy", 1);
// Security headers. CORP is cross-origin because the API is called from a separate frontend origin (CORS still gates access).
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    // Only the origins listed in CLIENT_ORIGIN may make credentialed requests.
    // Requests with no Origin header (curl, same-origin, server-to-server) are allowed.
    origin: (origin, cb) => cb(null, !origin || env.clientOrigins.includes(origin)),
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
if (!env.isProd) app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({ name: "ResuScan API", status: "ok", health: "/api/health" });
});

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/resumes",resumeRouter);
app.use("/api/job-matches", jobMatchRouter);
app.use("/api/improvements", improveRouter);

app.use("/api/dashboard", dashboardRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/versions", versionsRouter);
app.use("/api/history", historyRouter);

app.use("/api/dashboard", dashboardRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/versions", versionsRouter);
app.use("/api/history", historyRouter);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    app.listen(env.port, () => {
      console.log(`Server listening on http://localhost:${env.port} (${env.nodeEnv})`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

start();

module.exports = app;