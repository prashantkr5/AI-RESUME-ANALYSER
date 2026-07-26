import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import errorHandler, { notFound } from "./middleware/errorHandler.js";
import { generalLimiter } from "./middleware/rateLimiter.js";
import logger from "./utils/logger.js";

// ─── Load Environment ──────────────────────────────────────────────
dotenv.config();

// Startup safety checks — fallback JWT_REFRESH_SECRET to JWT_SECRET if omitted
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "default_jwt_secret_key_resume_roaster";
}
if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = process.env.JWT_SECRET;
}

// ─── Connect to MongoDB ────────────────────────────────────────────
connectDB();

const app = express();

// ─── Security Middleware ────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

import { CLIENT_ORIGINS } from "./config/env.js";

// Resilient CORS handling for Vercel serverless and local dev
app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        CLIENT_ORIGINS.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        process.env.VERCEL === "1" ||
        process.env.NODE_ENV !== "production"
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true
  })
);

// General rate limiting on ALL /api/* routes
app.use("/api", generalLimiter);

// ─── Body Parsing ───────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

import path from "path";

// Serve public avatar images statically
app.use("/uploads/avatars", express.static(path.resolve("uploads", "avatars")));

app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/analytics", analyticsRoutes);

// Base health check
app.get("/", (_req, res) => {
  res.json({ status: "healthy", service: "Resume Roaster API" });
});

// Catch 404 and forward to error handler
app.use(notFound);

// ─── Global Error Handler ───────────────────────────────────────────
// Must be registered LAST — catches all unhandled errors.
// Returns generic messages to client; logs full detail server-side.
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    logger.info(`[Server] running on port ${PORT}`);
  });
}

export default app;
