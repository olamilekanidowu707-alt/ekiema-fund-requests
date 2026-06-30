import "dotenv/config";
import "express-async-errors";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import fundRequestsRouter from "./routes/fundRequests";

export const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  })
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/fund-requests", fundRequestsRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
