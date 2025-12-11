import { createAuditLogs } from "./log.server";
import { prisma } from "./database.server";
import { FieldValidationError } from "./admin.server";

export async function getReviews(
  options: {
    model?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  try {
    const { model = "", fromDate, toDate, page = 1, limit = 10 } = options;

    const whereClause: any = {};

    if (model && model !== "all") {
      whereClause.modelId = model;
    }

    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) {
        whereClause.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);
        whereClause.createdAt.lt = endDate;
      }
    }

    const skip = (page - 1) * limit;

    const [reviews, totalCount] = await Promise.all([
      prisma.review.findMany({
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
        include: {
          model: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profile: true,
              status: true,
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profile: true,
              status: true,
            },
          },
        },
      }),
      prisma.review.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      reviews,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPreviousPage,
        limit,
      },
    };
  } catch (error) {
    console.error("FETCH_REVIEW_DATA_FAILED", error);
    throw new Error("Failed to get review!");
  }
}

export async function getModelsWithReviews() {
  try {
    const modelIds = await prisma.review.groupBy({
      by: ["modelId"],
    });
    const ids = modelIds.map((item) => item.modelId);
    const models = await prisma.model.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    return models;
  } catch (error) {
    console.error("GET_MODELS_WITH_REVIEWS_FAILED", error);
    throw new Error("Failed to get models with reviews.");
  }
}

export async function getReview(id: string) {
  try {
    return await prisma.review.findFirst({
      where: { id },
      include: {
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            status: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            status: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("GET_REVIEW_FAILED", error);
    throw new Error("Failed to fetch wallet!");
  }
}

export async function deleteReview(id: string, userId: string) {
  if (!id) throw new Error("Review id is required!");
  const auditBase = {
    action: "DELETE_REVIEW_ACCOUNT",
    user: userId,
  };
  try {
    const res = await prisma.review.delete({
      where: { id },
    });
    if (res.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Review with ID ${id} deleted successfully.`,
        status: "success",
        onSuccess: res,
      });
    }
    return res;
  } catch (error) {
    console.log("DELETE_REVIEW_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Review with ID ${id} deleted failed.`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Delete Review failed! Try again later!",
    });
  }
}

export async function getRatingDistribution() {
  const reviews = await prisma.review.findMany({
    select: { rating: true },
  });

  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => Math.round(r.rating) === star).length;
    return { stars: star, count };
  });

  const total = distribution.reduce((sum, item) => sum + item.count, 0);

  return distribution.map((item) => ({
    ...item,
    percentage: total === 0 ? 0 : Math.round((item.count / total) * 100),
  }));
}
