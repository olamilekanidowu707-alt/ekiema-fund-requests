import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

const createSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1).default("NGN"),
  purpose: z.string().min(1),
  description: z.string().optional(),
});

router.post("/", requireRole("STAFF", "MANAGER", "ACCOUNTANT", "ADMIN"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const requester = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!requester) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!requester.managerId) {
    return res.status(400).json({ error: "You have no assigned line manager. Ask an admin to set one before submitting requests." });
  }

  const { amount, currency, purpose, description } = parsed.data;

  const fundRequest = await prisma.fundRequest.create({
    data: {
      requesterId: requester.id,
      managerId: requester.managerId,
      amount,
      currency,
      purpose,
      description,
      status: "PENDING_MANAGER",
      approvalEvents: {
        create: { actorId: requester.id, action: "SUBMITTED" },
      },
    },
  });

  res.status(201).json(fundRequest);
});

router.get("/mine", async (req, res) => {
  const requests = await prisma.fundRequest.findMany({
    where: { requesterId: req.auth!.userId },
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

router.get("/pending-approval", requireRole("MANAGER", "ADMIN"), async (req, res) => {
  const requests = await prisma.fundRequest.findMany({
    where: { managerId: req.auth!.userId, status: "PENDING_MANAGER" },
    include: { requester: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(requests);
});

router.get("/pending-processing", requireRole("ACCOUNTANT", "ADMIN"), async (_req, res) => {
  const requests = await prisma.fundRequest.findMany({
    where: { status: "PENDING_ACCOUNTANT" },
    include: { requester: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(requests);
});

const recordsQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["PENDING_MANAGER", "PENDING_ACCOUNTANT", "PAID", "REJECTED_BY_MANAGER", "REJECTED_BY_ACCOUNTANT"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  minAmount: z.string().optional(),
  maxAmount: z.string().optional(),
});

router.get("/records", async (req, res) => {
  const parsed = recordsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { q, status, dateFrom, dateTo, minAmount, maxAmount } = parsed.data;
  const { userId, role } = req.auth!;

  const where: any = {};

  if (role === "STAFF") {
    where.requesterId = userId;
  } else if (role === "MANAGER") {
    where.OR = [{ managerId: userId }, { requesterId: userId }];
  }
  // ACCOUNTANT and ADMIN see all records, no requester/manager filter

  if (status) where.status = status;
  if (q) where.requester = { name: { contains: q, mode: "insensitive" } };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }
  if (minAmount || maxAmount) {
    where.amount = {};
    if (minAmount) where.amount.gte = Number(minAmount);
    if (maxAmount) where.amount.lte = Number(maxAmount);
  }

  const requests = await prisma.fundRequest.findMany({
    where,
    include: { requester: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

router.get("/:id", async (req, res) => {
  const fundRequest = await prisma.fundRequest.findUnique({
    where: { id: req.params.id },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      approvalEvents: {
        include: { actor: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!fundRequest) {
    return res.status(404).json({ error: "Not found" });
  }

  const { userId, role } = req.auth!;
  const isOwner = fundRequest.requesterId === userId;
  const isAssignedManager = fundRequest.managerId === userId;
  const isFinance = role === "ACCOUNTANT" || role === "ADMIN";
  if (!isOwner && !isAssignedManager && !isFinance) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.json(fundRequest);
});

const decisionSchema = z.object({
  approve: z.boolean(),
  comment: z.string().optional(),
});

router.patch("/:id/manager-decision", requireRole("MANAGER", "ADMIN"), async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const fundRequest = await prisma.fundRequest.findUnique({ where: { id: req.params.id } });
  if (!fundRequest) {
    return res.status(404).json({ error: "Not found" });
  }
  if (fundRequest.managerId !== req.auth!.userId) {
    return res.status(403).json({ error: "Only the requester's assigned manager can decide on this request" });
  }
  if (fundRequest.status !== "PENDING_MANAGER") {
    return res.status(409).json({ error: `Request is not pending manager review (status: ${fundRequest.status})` });
  }

  const { approve, comment } = parsed.data;
  const updated = await prisma.fundRequest.update({
    where: { id: fundRequest.id },
    data: {
      status: approve ? "PENDING_ACCOUNTANT" : "REJECTED_BY_MANAGER",
      approvalEvents: {
        create: {
          actorId: req.auth!.userId,
          action: approve ? "MANAGER_APPROVED" : "MANAGER_REJECTED",
          comment,
        },
      },
    },
  });

  res.json(updated);
});

router.patch("/:id/accountant-decision", requireRole("ACCOUNTANT", "ADMIN"), async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const fundRequest = await prisma.fundRequest.findUnique({ where: { id: req.params.id } });
  if (!fundRequest) {
    return res.status(404).json({ error: "Not found" });
  }
  if (fundRequest.status !== "PENDING_ACCOUNTANT") {
    return res.status(409).json({ error: `Request is not pending accountant processing (status: ${fundRequest.status})` });
  }

  const { approve, comment } = parsed.data;
  const updated = await prisma.fundRequest.update({
    where: { id: fundRequest.id },
    data: {
      status: approve ? "PAID" : "REJECTED_BY_ACCOUNTANT",
      approvalEvents: {
        create: {
          actorId: req.auth!.userId,
          action: approve ? "ACCOUNTANT_PAID" : "ACCOUNTANT_REJECTED",
          comment,
        },
      },
    },
  });

  res.json(updated);
});

export default router;
