import { Request, Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// documentData (the raw file bytes) is intentionally excluded from every
// response below — it's only ever streamed back via the dedicated
// /:id/document endpoint, otherwise every list response would carry full
// file payloads.
const fundRequestSelect = {
  id: true,
  requesterId: true,
  amount: true,
  currency: true,
  purpose: true,
  description: true,
  bankName: true,
  accountNumber: true,
  accountName: true,
  documentName: true,
  documentType: true,
  status: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
};

const createSchema = z.object({
  amount: z.coerce.number().positive(),
  currency: z.string().min(1).default("NGN"),
  purpose: z.string().min(1),
  description: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
});

router.post(
  "/",
  requireRole("STAFF", "MANAGER", "ACCOUNTANT", "ADMIN"),
  upload.single("document"),
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const requester = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!requester) {
      return res.status(404).json({ error: "User not found" });
    }

    const isManager = requester.role === "MANAGER" || requester.role === "ADMIN";

    if (!isManager && !requester.managerId) {
      return res.status(400).json({ error: "You have no assigned line manager. Ask an admin to set one before submitting requests." });
    }

    const { amount, currency, purpose, description, bankName, accountNumber, accountName } = parsed.data;
    const file = req.file;

    // Managers and admins bypass manager approval — go straight to accountant
    const initialStatus = isManager ? "PENDING_ACCOUNTANT" : "PENDING_MANAGER";
    const initialEvents = isManager
      ? [
          { actorId: requester.id, action: "SUBMITTED" as const },
          { actorId: requester.id, action: "MANAGER_APPROVED" as const },
        ]
      : [{ actorId: requester.id, action: "SUBMITTED" as const }];

    const fundRequest = await prisma.fundRequest.create({
      data: {
        requesterId: requester.id,
        managerId: requester.managerId ?? requester.id,
        amount,
        currency,
        purpose,
        description,
        bankName,
        accountNumber,
        accountName,
        documentName: file?.originalname,
        documentType: file?.mimetype,
        documentData: file?.buffer,
        status: initialStatus,
        approvalEvents: {
          create: initialEvents,
        },
      },
      select: fundRequestSelect,
    });

    res.status(201).json(fundRequest);
  }
);

router.get("/mine", async (req, res) => {
  const requests = await prisma.fundRequest.findMany({
    where: { requesterId: req.auth!.userId },
    select: fundRequestSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

router.get("/pending-approval", requireRole("MANAGER", "ADMIN"), async (req, res) => {
  const requests = await prisma.fundRequest.findMany({
    where: { managerId: req.auth!.userId, status: "PENDING_MANAGER" },
    select: { ...fundRequestSelect, requester: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(requests);
});

router.get("/pending-processing", requireRole("ACCOUNTANT", "ADMIN"), async (_req, res) => {
  const requests = await prisma.fundRequest.findMany({
    where: { status: "PENDING_ACCOUNTANT" },
    select: { ...fundRequestSelect, requester: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(requests);
});

router.get("/all", requireRole("ACCOUNTANT", "ADMIN"), async (_req, res) => {
  const requests = await prisma.fundRequest.findMany({
    select: {
      ...fundRequestSelect,
      requester: { select: { id: true, name: true, email: true } },
      approvalEvents: {
        select: {
          id: true,
          action: true,
          comment: true,
          createdAt: true,
          actor: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
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
    select: { ...fundRequestSelect, requester: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

async function loadAuthorizedRequest(req: Request) {
  const fundRequest = await prisma.fundRequest.findUnique({
    where: { id: req.params.id },
    select: { id: true, requesterId: true, managerId: true, documentName: true, documentType: true, documentData: true },
  });
  if (!fundRequest) return null;

  const { userId, role } = req.auth!;
  const isOwner = fundRequest.requesterId === userId;
  const isAssignedManager = fundRequest.managerId === userId;
  const isFinance = role === "ACCOUNTANT" || role === "ADMIN";
  if (!isOwner && !isAssignedManager && !isFinance) return "forbidden";

  return fundRequest;
}

router.get("/:id", async (req, res) => {
  const fundRequest = await prisma.fundRequest.findUnique({
    where: { id: req.params.id },
    select: {
      ...fundRequestSelect,
      requester: { select: { id: true, name: true, email: true } },
      approvalEvents: {
        select: {
          id: true,
          action: true,
          comment: true,
          createdAt: true,
          actor: { select: { id: true, name: true, role: true } },
        },
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

router.get("/:id/document", async (req, res) => {
  const result = await loadAuthorizedRequest(req);
  if (!result) {
    return res.status(404).json({ error: "Not found" });
  }
  if (result === "forbidden") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (!result.documentData) {
    return res.status(404).json({ error: "No document attached to this request" });
  }

  res.setHeader("Content-Type", result.documentType ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${result.documentName ?? "document"}"`);
  res.send(result.documentData);
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
    select: fundRequestSelect,
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
    select: fundRequestSelect,
  });

  res.json(updated);
});

export default router;
