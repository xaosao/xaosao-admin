import { IModelServicesInput, IServicesInput } from "~/interfaces/service";
import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./admin.server";

export async function getServices() {
  try {
    return await prisma.service.findMany();
  } catch (error) {
    console.error("GET_SERVICES_FAILED", error);
    throw new Error("Failed to fetch services!");
  }
}

export async function getService(id: string) {
  try {
    return await prisma.service.findFirst({
      where: { id },
    });
  } catch (error) {
    console.error("GET_SERVICES_FAILED", error);
    throw new Error("Failed to fetch services!");
  }
}

export async function createService(data: IServicesInput, userId: string) {
  if (!data || !userId) throw new Error("Missing service creation data!");
  const auditBase = {
    action: "CREATE_SERVICE",
    user: userId,
  };

  try {
    const res = await prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        baseRate: data.baseRate,
        commission: data.commission,
        status: data.status,
        createdBy: { connect: { id: userId } },
      },
    });

    if (res.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create server: ${res.id} successfully.`,
        status: "success",
        onSuccess: res,
      });
    }

    return res;
  } catch (error: any) {
    console.error("CREATE_SERVICE_FAILED", error);

    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target === "service_name_key") {
        throw new FieldValidationError({
          number: "This service is already exist!",
        });
      }
    }

    await createAuditLogs({
      ...auditBase,
      description: `Created service failed.`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Failed to create service!",
    });
  }
}

export async function updateService(
  id: string,
  data: IServicesInput,
  userId: string
) {
  if (!id || !data || !userId) throw new Error("Missing service update data!");
  const auditBase = {
    action: "UPDATE_SERVICE",
    user: userId,
  };

  try {
    const res = await prisma.service.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        baseRate: data.baseRate,
        commission: data.commission,
        status: data.status,
        createdBy: { connect: { id: userId } },
      },
    });

    if (res.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update service: ${res.id} successfully.`,
        status: "success",
        onSuccess: res,
      });
    }

    return res;
  } catch (error: any) {
    console.error("UPDATE_SERVICE_FAILED", error);

    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target === "service_name_key") {
        throw new FieldValidationError({
          number: "This service is already exist! Try another one.",
        });
      }
    }
    await createAuditLogs({
      ...auditBase,
      description: `Update service failed.`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      number: "Failed to update service! Try again later.",
    });
  }
}

export async function deleteService(id: string, userId: string) {
  if (!id) throw new Error("Service id is required!");
  const auditBase = {
    action: "DELETE_SERVICE",
    user: userId,
  };

  try {
    const res = await prisma.service.delete({
      where: { id },
    });

    if (res.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Service with ID ${id} deleted successfully.`,
        status: "success",
        onSuccess: res,
      });
    }
    return res;
  } catch (error) {
    console.log("DELETE_SERVICE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Service with ID ${id} deleted failed.`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Failed to delete service, Try again later!",
    });
  }
}

export async function getServicesStatus() {
  return null;
}

//================== Model services:
export async function getModelServicesByModelId(modelId: string) {
  if (!modelId) throw new Error("Model ID is required");

  try {
    const modelServices = await prisma.model_service.findMany({
      where: {
        modelId,
      },
      select: {
        id: true,
        customRate: true,
        minSessionDuration: true,
        maxSessionDuration: true,
        status: true,
        service: {
          where: {
            status: "active",
          },
          select: {
            id: true,
            name: true,
            baseRate: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return modelServices;
  } catch (error) {
    console.error("GET_MODEL_SERVICES_FAILED", error);
    throw new Error("Failed to fetch model services");
  }
}

export async function updateModelService(
  data: IModelServicesInput,
  userId: string
) {
  if (!data || !data.id) throw new Error("Missing model service update data!");

  const auditBase = {
    action: "UPDATE_MODEL_SERVICE",
    user: userId,
  };

  try {
    const res = await prisma.model_service.update({
      where: { id: data.id },
      data: {
        customRate: data.customRate,
        minSessionDuration: data.minSessionDuration,
        maxSessionDuration: data.maxSessionDuration,
        isAvailable: data.isAvailable,
        status: data.status,
        updatedAt: new Date(),
      },
    });

    if (res.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update model service: ${res.id} successfully.`,
        status: "success",
        onSuccess: res,
      });
    }

    return res;
  } catch (error) {
    console.error("UPDATE_MODEL_SERVICE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update model service failed.`,
      status: "failed",
      onError: error,
    });
    throw new Error("Failed to update model service!");
  }
}

export async function createModalService(modelId: string) {
  if (!modelId) throw new Error("Model id is required!");

  const auditBase = {
    action: "CREATE_NEW_MODEL_SERVICE_AFTER_SIGN_UP",
    model: modelId,
  };

  try {
    const services = await getServices();

    const modelServiceData = services.map((service) => ({
      modelId: modelId,
      serviceId: service.id,
      customRate: service.baseRate,
      minSessionDuration: 5,
      maxSessionDuration: 60,
      isAvailable: false,
      status: "inactive",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const res = await prisma.model_service.createMany({
      data: modelServiceData,
    });

    await createAuditLogs({
      ...auditBase,
      description: `Created ${res.count} model service records successfully.`,
      status: "success",
      onSuccess: res,
    });

    return res;
  } catch (error) {
    console.error("CREATE_MODEL_SERVICE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Create model services failed.`,
      status: "failed",
      onError: error,
    });
    throw new Error("Failed to create model services!");
  }
}
