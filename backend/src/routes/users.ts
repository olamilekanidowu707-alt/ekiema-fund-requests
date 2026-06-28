import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, managerId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["STAFF", "MANAGER", "ACCOUNTANT", "ADMIN"]).optional(),
  managerId: z.string().nullable().optional(),
});

router.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { id } = req.params;

  if (parsed.data.managerId === id) {
    return res.status(400).json({ error: "A user cannot be their own manager" });
  }

  if (parsed.data.managerId) {
    const manager = await prisma.user.findUnique({ where: { id: parsed.data.managerId } });
    if (!manager) {
      return res.status(400).json({ error: "managerId does not refer to an existing user" });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true, managerId: true },
  });
  res.json(user);
});

export default router;
