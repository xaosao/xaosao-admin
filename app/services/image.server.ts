import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";

interface ImageFilters {
  search?: string;
  userType?: "all" | "model" | "customer";
  page?: number;
  limit?: number;
}

interface ImageItem {
  id: string;
  url: string;
  type: "gallery" | "profile";
  ownerType: "model" | "customer";
  ownerId: string;
  ownerName: string;
  ownerProfile: string | null;
  status: string;
  createdAt: Date;
}

export async function getImages(filters: ImageFilters = {}) {
  const { search = "", userType = "all", page = 1, limit = 50 } = filters;
  const skip = (page - 1) * limit;

  const results: ImageItem[] = [];

  // 1. Gallery images from images table
  const galleryWhere: any = {};
  if (userType === "model") {
    galleryWhere.modelId = { not: null };
    galleryWhere.customerId = null;
  } else if (userType === "customer") {
    galleryWhere.customerId = { not: null };
    galleryWhere.modelId = null;
  }

  if (search) {
    galleryWhere.OR = [
      { model: { firstName: { contains: search, mode: "insensitive" } } },
      { model: { lastName: { contains: search, mode: "insensitive" } } },
      { customer: { firstName: { contains: search, mode: "insensitive" } } },
      { customer: { lastName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const galleryImages = await prisma.images.findMany({
    where: galleryWhere,
    orderBy: { createdAt: "desc" },
    include: {
      model: { select: { id: true, firstName: true, lastName: true, profile: true } },
      customer: { select: { id: true, firstName: true, lastName: true, profile: true } },
    },
  });

  for (const img of galleryImages) {
    const owner = img.modelId ? img.model : img.customer;
    if (!owner) continue;
    results.push({
      id: img.id,
      url: img.name,
      type: "gallery",
      ownerType: img.modelId ? "model" : "customer",
      ownerId: owner.id,
      ownerName: `${owner.firstName} ${owner.lastName || ""}`.trim(),
      ownerProfile: owner.profile,
      status: img.status,
      createdAt: img.createdAt,
    });
  }

  // 2. Profile images from model table
  if (userType === "all" || userType === "model") {
    const modelWhere: any = {
      profile: { not: null },
    };
    if (search) {
      modelWhere.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }

    const models = await prisma.model.findMany({
      where: modelWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profile: true,
        profileHiddenByAdmin: true,
        createdAt: true,
      },
    });

    for (const m of models) {
      if (!m.profile) continue;
      results.push({
        id: `model-profile-${m.id}`,
        url: m.profile,
        type: "profile",
        ownerType: "model",
        ownerId: m.id,
        ownerName: `${m.firstName} ${m.lastName || ""}`.trim(),
        ownerProfile: m.profile,
        status: m.profileHiddenByAdmin ? "hidden" : "active",
        createdAt: m.createdAt,
      });
    }
  }

  // 3. Profile images from customer table
  if (userType === "all" || userType === "customer") {
    const customerWhere: any = {
      profile: { not: null },
    };
    if (search) {
      customerWhere.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where: customerWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profile: true,
        profileHiddenByAdmin: true,
        createdAt: true,
      },
    });

    for (const c of customers) {
      if (!c.profile) continue;
      results.push({
        id: `customer-profile-${c.id}`,
        url: c.profile,
        type: "profile",
        ownerType: "customer",
        ownerId: c.id,
        ownerName: `${c.firstName} ${c.lastName || ""}`.trim(),
        ownerProfile: c.profile,
        status: c.profileHiddenByAdmin ? "hidden" : "active",
        createdAt: c.createdAt,
      });
    }
  }

  // Sort all by createdAt DESC
  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Paginate
  const totalCount = results.length;
  const paginatedResults = results.slice(skip, skip + limit);
  const hasMore = skip + limit < totalCount;

  return {
    images: paginatedResults,
    pagination: { page, limit, totalCount, hasMore },
  };
}

/**
 * Check which image URLs are broken (404 from CDN)
 * Uses GET with range header as fallback since some CDNs reject HEAD requests
 */
export async function checkBrokenImages(imageUrls: string[]): Promise<Set<string>> {
  const broken = new Set<string>();

  const checks = imageUrls.map(async (url) => {
    try {
      // Try HEAD first
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      if (res.ok) return;

      // If HEAD fails (some CDNs return 403/405 for HEAD), try GET with range to minimize data
      if (res.status === 403 || res.status === 405 || res.status === 501) {
        const getRes = await fetch(url, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          signal: AbortSignal.timeout(5000),
        });
        if (getRes.ok || getRes.status === 206) return;
      }

      broken.add(url);
    } catch {
      broken.add(url);
    }
  });

  await Promise.all(checks);
  return broken;
}

/**
 * Hide a gallery image (set status to "hidden")
 */
export async function hideGalleryImage(imageId: string, adminUserId: string) {
  const image = await prisma.images.update({
    where: { id: imageId },
    data: { status: "hidden" },
  });

  await createAuditLogs({
    action: "HIDE_IMAGE",
    user: adminUserId,
    description: `Hidden gallery image ${imageId}`,
    status: "success",
    onSuccess: { imageId },
  });

  return image;
}

/**
 * Unhide a gallery image (set status back to "active")
 */
export async function unhideGalleryImage(imageId: string, adminUserId: string) {
  const image = await prisma.images.update({
    where: { id: imageId },
    data: { status: "active" },
  });

  await createAuditLogs({
    action: "UNHIDE_IMAGE",
    user: adminUserId,
    description: `Unhidden gallery image ${imageId}`,
    status: "success",
    onSuccess: { imageId },
  });

  return image;
}

/**
 * Hide a profile image (set profileHiddenByAdmin = true)
 */
export async function hideProfileImage(
  ownerType: "model" | "customer",
  ownerId: string,
  adminUserId: string
) {
  if (ownerType === "model") {
    await prisma.model.update({
      where: { id: ownerId },
      data: { profileHiddenByAdmin: true },
    });
  } else {
    await prisma.customer.update({
      where: { id: ownerId },
      data: { profileHiddenByAdmin: true },
    });
  }

  await createAuditLogs({
    action: "HIDE_PROFILE_IMAGE",
    user: adminUserId,
    description: `Hidden ${ownerType} profile image for ${ownerId}`,
    status: "success",
    onSuccess: { ownerType, ownerId },
  });
}

/**
 * Unhide a profile image (set profileHiddenByAdmin = false)
 */
export async function unhideProfileImage(
  ownerType: "model" | "customer",
  ownerId: string,
  adminUserId: string
) {
  if (ownerType === "model") {
    await prisma.model.update({
      where: { id: ownerId },
      data: { profileHiddenByAdmin: false },
    });
  } else {
    await prisma.customer.update({
      where: { id: ownerId },
      data: { profileHiddenByAdmin: false },
    });
  }

  await createAuditLogs({
    action: "UNHIDE_PROFILE_IMAGE",
    user: adminUserId,
    description: `Unhidden ${ownerType} profile image for ${ownerId}`,
    status: "success",
    onSuccess: { ownerType, ownerId },
  });
}
