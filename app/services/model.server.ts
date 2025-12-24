import { prisma } from "./database.server";
import { default as bcrypt } from "bcryptjs";
import { createWallet } from "./wallet.server";
import { createAuditLogs } from "./log.server";
import { UserStatus } from "~/interfaces/base";
import { getLocationDetails } from "./ip.server";
import { FieldValidationError } from "./admin.server";
import { createModalService } from "./service.server";
import { IModelInput, IModelUpdateInput } from "~/interfaces/model";
import { extractFilenameFromCDNSafe } from "~/utils";
import { deleteFileFromBunny } from "./upload.server";
import { processReferralReward, ensureReferralCode } from "./referral.server";
import { notifyModelApproved, notifyModelRejected } from "./email.server";

const { hash } = bcrypt;

export async function getModels(
  options: {
    search?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  try {
    const {
      search = "",
      status = "all",
      fromDate,
      toDate,
      page = 1,
      limit = 10,
    } = options;
    const whereClause: any = {};
    if (search) {
      const searchConditions = [
        {
          firstName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          lastName: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
      whereClause.OR = searchConditions;
    }

    if (status !== "all") {
      whereClause.status = status;
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
    const [models, totalCount] = await Promise.all([
      prisma.model.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          ModelService: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  baseRate: true,
                },
              },
            },
          },
        },
      }),
      prisma.model.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      models,
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
    console.error("GET_MODELS_FAILED", error);
    throw new Error("Failed to fetch models!");
  }
}

export async function getModel(id: string) {
  try {
    return await prisma.model.findFirst({
      where: { id },
      include: {
        ModelService: {
          include: {
            service: {
              where: { status: "active" },
              select: {
                id: true,
                name: true,
                baseRate: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        approveBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        rejectedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("GET_MODEL_FAILED", error);
    throw new Error("Failed to fetch model!");
  }
}

export async function getPendingModelCount() {
  try {
    const count = await prisma.model.count({
      where: {
        status: "pending",
      },
    });

    return count;
  } catch (error) {
    console.error("GET_PENDING_MODEL_COUNT_FAILED", error);
    throw new Error("Failed to count pending models!");
  }
}

export async function getModelStatus() {
  try {
    const [total, active, suspended, inactive] = await Promise.all([
      prisma.model.count(),
      prisma.model.count({
        where: { status: "active" },
      }),
      prisma.model.count({
        where: { status: "suspended" },
      }),
      prisma.model.count({
        where: { status: "inactive" },
      }),
    ]);

    const format = (val: number) => new Intl.NumberFormat("en-US").format(val);

    const result = [
      {
        title: "Total models",
        value: format(total),
        icon: "Heart",
        color: "text-blue-600",
      },
      {
        title: "Active models",
        value: format(active),
        icon: "UserCheck",
        color: "text-green-600",
      },
      {
        title: "Suspended models",
        value: format(suspended),
        icon: "UserLock",
        color: "text-yellow-600",
      },
      {
        title: "Inactive models",
        value: format(inactive),
        icon: "UserX",
        color: "text-red-600",
      },
    ];

    return result;
  } catch (err) {
    console.error("FETCH_MODEL_STATUS_FAILED", err);
    throw new Error("Failed to get model status!");
  }
}

export async function getModelsApproval(
  options: {
    search?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  try {
    const { search = "", fromDate, toDate, page = 1, limit = 10 } = options;
    const whereClause: any = {};
    if (search) {
      const searchConditions = [
        {
          firstName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          lastName: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
      whereClause.OR = searchConditions;
    }

    whereClause.status = "pending";

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
    const [models, totalCount] = await Promise.all([
      prisma.model.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          ModelService: {
            where: { status: "active" },
            include: {
              service: {
                where: { status: "active" },
                select: {
                  id: true,
                  name: true,
                  baseRate: true,
                },
              },
            },
          },
        },
      }),
      prisma.model.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      models,
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
    console.error("GET_MODELS_FAILED", error);
    throw new Error("Failed to fetch models!");
  }
}

export async function createModel(
  data: IModelInput,
  userId: string,
  ip: string,
  accessKey: string
) {
  if (!data || !userId) throw new Error("Missing model creation data!");
  const auditBase = {
    action: "CREATE_MODEL",
    user: userId,
  };
  try {
    const existingModel = await prisma.customer.findFirst({
      where: { whatsapp: data.whatsapp },
    });

    if (existingModel) {
      throw new FieldValidationError({
        id: "This model whatsapp number is already exist!",
      });
    }

    const locationDetails = await getLocationDetails(ip, accessKey);
    const passwordHash = await hash(data.password, 12);

    const model = await prisma.model.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        password: passwordHash,
        gender: data.gender,
        dob: new Date(data.dob),
        whatsapp: +data.whatsapp,
        address: data.address,
        bio: data.bio,
        status: data.status,
        latitude: +locationDetails.latitude,
        longitude: +locationDetails.longitude,
        location: locationDetails,
        available_status: data.available_status,
        profile: data.profile,
        createdBy: { connect: { id: userId } },
      },
    });

    if (model.id) {
      await createWallet(
        {
          totalBalance: 0,
          totalRecharge: 0,
          totalDeposit: 0,
          status: UserStatus.ACTIVE,
          model: model.id,
        },
        userId
      );

      await createModalService(model.id);

      await createAuditLogs({
        ...auditBase,
        description: `Create model: ${model.id} successfully.`,
        status: "success",
        onSuccess: model,
      });
    }

    return model;
  } catch (error: any) {
    console.error("CREATE_MODEL_FAILED", error);

    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target === "model_whatsapp_key") {
        throw new FieldValidationError({
          whatsapp: "This whatsapp number is already in exist!",
        });
      }
    }

    await createAuditLogs({
      ...auditBase,
      description: `Crate new model failed.`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Failed to create model account!",
    });
  }
}

export async function updateModel(
  id: string,
  data: IModelUpdateInput,
  userId: string,
  ip: string,
  accessKey: string
) {
  if (!id || !data || !userId) throw new Error("Missing model updating data!");
  const auditBase = {
    action: "UPDATE_MODEL",
    user: userId,
  };
  try {
    const existingModel = await prisma.model.findFirst({
      where: { id },
    });

    if (!existingModel) {
      const error = new Error("Model is not found!") as any;
      error.status = 422;
      throw error;
    }

    const locationDetails = await getLocationDetails(ip, accessKey);

    const model = await prisma.model.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        dob: new Date(data.dob),
        whatsapp: +data.whatsapp,
        address: data.address,
        bio: data.bio,
        status: data.status,
        latitude: +locationDetails.latitude,
        longitude: +locationDetails.longitude,
        location: locationDetails,
        available_status: data.available_status,
        ...(data.profile && { profile: data.profile }),
        updatedAt: new Date(),
      },
    });

    if (model.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update model: ${model.id} successfully.`,
        status: "success",
        onSuccess: model,
      });
    }
    return model;
  } catch (error: any) {
    console.error("UPDATE_MODEL_FAILED", error);

    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target === "model_whatsapp_key") {
        throw new FieldValidationError({
          whatsapp: "This whatsapp number is already in exist!",
        });
      }
    }

    await createAuditLogs({
      ...auditBase,
      description: `Update model info failed.`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Failed to update model account!",
    });
  }
}

export async function deleteModel(id: string, userId: string) {
  if (!id) throw new Error("Model id is required!");
  const auditBase = {
    action: "DELETE_MODEL_ACCOUNT",
    user: userId,
  };
  try {
    const model = await prisma.model.delete({
      where: { id },
    });
    if (model.id) {
      const filePath = extractFilenameFromCDNSafe(model.profile ?? "");
      await deleteFileFromBunny(filePath);
      await createAuditLogs({
        ...auditBase,
        description: `Model with ID ${id} deleted successfully.`,
        status: "success",
        onSuccess: model,
      });
    }
    return model;
  } catch (error) {
    console.log("DELETE_MODEL_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Model with ID ${id} deleted failed.`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      id: "Delete model failed! Try again later!",
    });
  }
}

export async function approveModel(id: string, userId: string) {
  if (!id || !userId) throw new Error("Missing model approval data!");
  const auditBase = {
    action: "APPROVE_MODEL",
    user: userId,
  };
  try {
    const existingModel = await prisma.model.findFirst({
      where: { id },
    });

    if (!existingModel) {
      throw new FieldValidationError({
        id: "Model is not found to approve!",
      });
    }

    const model = await prisma.model.update({
      where: { id },
      data: {
        status: "active",
        approveBy: { connect: { id: userId } },
        updatedAt: new Date(),
      },
    });

    if (model.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Approve new model: ${model.id} successfully.`,
        status: "success",
        onSuccess: model,
      });

      // Generate referral code for the newly approved model
      await ensureReferralCode(model.id);

      // Process referral reward if this model was referred by another model
      const referralResult = await processReferralReward(model.id, userId);
      if (referralResult.success) {
        console.log(`Referral reward processed for model ${model.id}: ${referralResult.amount} Kip to referrer ${referralResult.referrerId}`);
      }

      // Send email and SMS notification to the model
      notifyModelApproved({
        id: model.id,
        firstName: model.firstName,
        lastName: model.lastName,
        whatsapp: model.whatsapp,
      });
    }
    return model;
  } catch (error) {
    console.error("APPROVE_MODEL_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Approve model info failed.`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      id: "Failed to approve model account!",
    });
  }
}

export async function rejectModel(id: string, userId: string) {
  if (!id || !userId) throw new Error("Missing model reject data!");
  const auditBase = {
    action: "REJECT_MODEL",
    user: userId,
  };
  try {
    const existingModel = await prisma.model.findFirst({
      where: { id },
    });

    if (!existingModel) {
      throw new FieldValidationError({
        id: "Model is not found to reject!",
      });
    }

    const model = await prisma.model.update({
      where: { id },
      data: {
        status: "inactive",
        rejectedBy: { connect: { id: userId } },
        updatedAt: new Date(),
      },
    });

    if (model.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Reject new model: ${model.id} successfully.`,
        status: "success",
        onSuccess: model,
      });

      // Send email and SMS notification to the model
      notifyModelRejected({
        id: model.id,
        firstName: model.firstName,
        lastName: model.lastName,
        whatsapp: model.whatsapp,
      });
    }
    return model;
  } catch (error) {
    console.error("REJECT_MODEL_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Reject model info failed.`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      id: "Failed to reject model account!",
    });
  }
}
