import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { consumeLimit } from "@/lib/rate-limit";
import { requireRole } from "@/modules/users/access";
import { idSchema } from "@/modules/users/validation";

const pageSize = 20;

export async function dashboardMetrics(eventId?: string) {
  await requireRole(["ADMIN"]);
  if (eventId) idSchema.parse(eventId);
  const db = getDb();
  const eventWhere = eventId ? { eventId } : {};
  const ticketWhere: Prisma.TicketWhereInput = {
    ...eventWhere,
    status: { in: ["VALID", "USED"] },
    OR: [{ orderId: null }, { order: { status: "PAID" } }],
  };
  const [
    events,
    capacity,
    soldTickets,
    usedTickets,
    paidPayments,
    pendingOrders,
  ] = await Promise.all([
    db.event.findMany({
      orderBy: [{ startsAt: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.ticketType.aggregate({
      where: {
        active: true,
        event: { status: "PUBLISHED" },
        ...(eventId ? { eventId } : {}),
      },
      _sum: { stock: true, sold: true, reserved: true },
    }),
    db.ticket.count({ where: ticketWhere }),
    db.ticket.count({
      where: { ...ticketWhere, status: "USED" },
    }),
    db.payment.aggregate({
      where: {
        status: "APPROVED",
        applied: true,
        order: { status: "PAID", ...(eventId ? { eventId } : {}) },
      },
      _sum: { amountCents: true },
    }),
    db.order.count({
      where: {
        ...eventWhere,
        status: "PENDING",
        paymentStartedAt: { not: null },
      },
    }),
  ]);
  const stock = capacity._sum.stock ?? 0;
  const sold = capacity._sum.sold ?? 0;
  const reserved = capacity._sum.reserved ?? 0;
  return {
    events,
    metrics: {
      soldTickets,
      availableTickets: Math.max(0, stock - sold - reserved),
      revenueCents: paidPayments._sum.amountCents ?? 0,
      pendingOrders,
      usedTickets,
      attendancePercent: soldTickets
        ? Math.round((usedTickets / soldTickets) * 100)
        : 0,
    },
  };
}

export async function salesEvents() {
  await requireRole(["ADMIN"]);
  return getDb().event.findMany({
    orderBy: [{ startsAt: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

export async function searchSales(filters: {
  eventId?: string;
  query?: string;
  status?:
    | "PENDING"
    | "PAID"
    | "REJECTED"
    | "CANCELLED"
    | "EXPIRED"
    | "PAYMENT_REVIEW";
  page: number;
}) {
  const actor = await requireRole(["ADMIN"]);
  await consumeLimit("admin-sales-search", actor.id, 60, 60);
  if (filters.eventId) idSchema.parse(filters.eventId);
  if (filters.page < 1 || filters.page > 100000)
    throw new AppError("INVALID_PAGE", "La página solicitada no es válida.");

  const where: Prisma.OrderWhereInput = {
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.query
      ? {
          OR: [
            { id: { contains: filters.query, mode: "insensitive" } },
            { firstName: { contains: filters.query, mode: "insensitive" } },
            { lastName: { contains: filters.query, mode: "insensitive" } },
            { email: { contains: filters.query, mode: "insensitive" } },
            { dni: { contains: filters.query } },
            {
              tickets: {
                some: {
                  number: { contains: filters.query, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),
  };
  const [orders, count] = await Promise.all([
    getDb().order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * pageSize,
      take: pageSize + 1,
      select: {
        id: true,
        status: true,
        firstName: true,
        lastName: true,
        email: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        paidAt: true,
        event: { select: { name: true } },
        _count: { select: { tickets: true } },
      },
    }),
    getDb().order.count({ where }),
  ]);
  return {
    orders: orders.slice(0, pageSize),
    hasNext: orders.length > pageSize,
    count,
  };
}

export async function listAuditEntries(page: number) {
  await requireRole(["ADMIN"]);
  if (!Number.isInteger(page) || page < 1 || page > 100000)
    throw new AppError("INVALID_PAGE", "La página solicitada no es válida.");
  return getDb().auditLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      reason: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });
}
