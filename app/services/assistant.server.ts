/**
 * AI assistant conversations — admin side.
 *
 * Customers describe who they are looking for and the assistant answers
 * with matches. This is where an admin reads those conversations and,
 * when the automatic match was poor, sends a hand-picked model instead.
 *
 * An admin suggestion is written into the same thread the customer sees,
 * so it lands in the assistant sheet next time they open it rather than
 * in some separate inbox.
 */

import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./admin.server";

/**
 * How many candidates to consider before distance picks the page, when
 * the conversation's customer has a location.
 */
const NEARBY_POOL = 60;

/**
 * Distances beyond this are shown as unknown. Several test accounts sit
 * on the Android emulator's default location in California; the
 * coordinates are valid, so no range check catches them, but
 * "12,281 km away" is noise on a card for a service operating in Laos.
 */
const MAX_SENSIBLE_KM = 1500;

export interface AssistantMatchCard {
  id: string;
  name: string;
  profile: string | null;
  age: number | null;
  rating: number;
  address: string | null;
  fromPrice: number | null;
  /**
   * Straight-line km from the customer being answered. Null when either
   * side has no coordinates — an absent figure beats an invented one
   * when an admin is choosing who to send.
   */
  distanceKm: number | null;
}

/** Conversations, busiest first. */
export async function getAssistantConversations(options: {
  search?: string;
  page?: number;
  limit?: number;
} = {}) {
  const { search = "", page = 1, limit = 20 } = options;

  const where: any = {};
  if (search.trim()) {
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    where.customerId = { in: customers.map((c) => c.id) };
  }

  const [rows, total] = await Promise.all([
    prisma.assistant_conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, profile: true, whatsapp: true },
        },
      },
    }),
    prisma.assistant_conversation.count({ where }),
  ]);

  return {
    conversations: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

/** One conversation with its full thread, oldest first. */
export async function getAssistantConversation(id: string) {
  return prisma.assistant_conversation.findUnique({
    where: { id },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, profile: true, whatsapp: true },
      },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });
}

/**
 * Models an admin can pick from when answering by hand.
 *
 * Same eligibility rule as discover and the assistant — active and not
 * profile-hidden — so an admin cannot send someone the customer would be
 * unable to open.
 */
export async function searchModelsForSuggestion(
  query: string,
  limit = 24,
  /** Answering customer, so candidates can be sorted and shown by distance. */
  customerId?: string
) {
  const where: any = { status: "active", isProfileHidden: { not: true } };
  if (query.trim()) {
    where.OR = [
      { firstName: { contains: query, mode: "insensitive" } },
      { lastName: { contains: query, mode: "insensitive" } },
    ];
  }

  // When answering a located customer, consider a wider pool than the
  // page: sorting a recency-picked list by distance only looks like
  // proximity, and an admin picking "who is closest" would never see a
  // quiet profile next door.
  const pool = customerId ? Math.max(limit, NEARBY_POOL) : limit;

  const [models, customer] = await Promise.all([
    prisma.model.findMany({
      where,
      orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
      take: pool,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profile: true,
        dob: true,
        rating: true,
        address: true,
        latitude: true,
        longitude: true,
      },
    }),
    customerId
      ? prisma.customer.findUnique({
          where: { id: customerId },
          select: { latitude: true, longitude: true },
        })
      : Promise.resolve(null),
  ]);

  const from =
    customer && Number.isFinite(customer.latitude) && Number.isFinite(customer.longitude)
      ? { lat: Number(customer.latitude), lng: Number(customer.longitude) }
      : null;

  const cards = models.map((m) => toCard(m, from));

  // Nearest first when we know where the customer is; unknown distances
  // sink rather than pretending to be far.
  if (from) {
    cards.sort((a, b) => {
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }

  return cards.slice(0, limit);
}

/** Straight-line km between two points, or null if either is missing. */
function distanceKm(
  from: { lat: number; lng: number } | null,
  lat: unknown,
  lng: unknown
): number | null {
  if (!from) return null;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (!a && !b) return null;

  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(a - from.lat);
  const dLon = toRad(b - from.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(a)) * Math.sin(dLon / 2) ** 2;
  const km = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  if (km > MAX_SENSIBLE_KM) return null;
  return Math.round(km * 10) / 10;
}

function toCard(
  m: {
    id: string;
    firstName: string;
    lastName: string | null;
    profile: string | null;
    dob: Date | null;
    rating: number | null;
    address: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
  from: { lat: number; lng: number } | null = null
): AssistantMatchCard {
  const age = m.dob
    ? Math.floor((Date.now() - new Date(m.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return {
    id: m.id,
    name: `${m.firstName} ${m.lastName ?? ""}`.trim(),
    profile: m.profile,
    age: age && age > 0 && age < 100 ? age : null,
    rating: Number(m.rating ?? 0),
    address: m.address,
    fromPrice: null,
    distanceKm: distanceKm(from, m.latitude, m.longitude),
  };
}

/**
 * Send a hand-picked suggestion into the customer's assistant thread.
 *
 * Written as a message with `role: "admin"`, so the customer sees it in
 * the same place as the AI's answers and the admin list can show which
 * conversations a human has already handled.
 */
export async function sendAssistantSuggestion(
  conversationId: string,
  adminId: string,
  text: string,
  modelIds: string[]
) {
  const conversation = await prisma.assistant_conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, customerId: true },
  });
  if (!conversation) {
    throw new FieldValidationError({ id: "Conversation not found" });
  }

  const message = (text || "").trim();
  if (!message && modelIds.length === 0) {
    throw new FieldValidationError({
      text: "Write a message, pick at least one model, or both.",
    });
  }

  // Re-read the models now rather than trusting the ids from the form —
  // one may have been suspended since the admin opened the page.
  let cards: AssistantMatchCard[] = [];
  if (modelIds.length > 0) {
    const models = await prisma.model.findMany({
      where: { id: { in: modelIds }, status: "active", isProfileHidden: { not: true } },
      select: {
        id: true, firstName: true, lastName: true, profile: true,
        dob: true, rating: true, address: true,
        latitude: true, longitude: true,
      },
    });

    const customer = await prisma.customer.findUnique({
      where: { id: conversation.customerId },
      select: { latitude: true, longitude: true },
    });
    const from =
      customer && Number.isFinite(customer.latitude) && Number.isFinite(customer.longitude)
        ? { lat: Number(customer.latitude), lng: Number(customer.longitude) }
        : null;

    cards = models.map((m) => toCard(m, from));

    if (cards.length === 0) {
      throw new FieldValidationError({
        text: "None of those models can be shown to customers any more.",
      });
    }
  }

  const now = new Date();
  await prisma.assistant_message.create({
    data: {
      conversationId,
      role: "admin",
      text: message || "Here are some suggestions for you.",
      matches: cards.length ? (cards as any) : undefined,
      sentById: adminId,
      createdAt: now,
    },
  });

  await prisma.assistant_conversation.update({
    where: { id: conversationId },
    data: {
      hasAdminReply: true,
      unreadByCustomer: { increment: 1 },
      lastMessageAt: now,
      lastMessageText: (message || "Suggestions sent").slice(0, 200),
      messageCount: { increment: 1 },
      updatedAt: now,
    },
  });

  await createAuditLogs({
    action: "SEND_ASSISTANT_SUGGESTION",
    user: adminId,
    description: `Sent ${cards.length} suggestion(s) to customer ${conversation.customerId} via the assistant.`,
    status: "success",
    onSuccess: { conversationId, modelIds: cards.map((c) => c.id) },
  });

  // Push + in-app row, so the customer knows to come back and look.
  try {
    const { notifyViaBackend } = await import("./email.server");
    await notifyViaBackend({
      userType: "customer",
      userId: conversation.customerId,
      type: "admin_broadcast",
      title: "We found someone for you",
      message: message || "Tap to see the people we picked for you.",
      is_admin: true,
      raw_text: true,
      data: { screen: "home", conversationId },
    });
  } catch (error) {
    // The suggestion is already saved; a failed push just means they see
    // it the next time they open the assistant.
    console.error("ASSISTANT_SUGGESTION_NOTIFY_FAILED", error);
  }

  return { sent: cards.length };
}
