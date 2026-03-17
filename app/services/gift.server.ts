import { prisma } from "./database.server";
import { uploadFileToBunnyServer, deleteFileFromBunny } from "./upload.server";

interface GetGiftsOptions {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
}

export async function getGifts(options: GetGiftsOptions = {}) {
    const {
        search = "",
        status = "all",
        page = 1,
        limit = 20,
    } = options;

    const where: any = {};

    if (search) {
        where.name = { contains: search, mode: "insensitive" };
    }

    if (status && status !== "all") {
        where.status = status;
    }

    const skip = (page - 1) * limit;

    const [gifts, totalCount] = await Promise.all([
        prisma.gift.findMany({
            where,
            orderBy: { sortOrder: "asc" },
            skip,
            take: limit,
        }),
        prisma.gift.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
        gifts,
        pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            limit,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        },
    };
}

export async function getGift(id: string) {
    return prisma.gift.findUnique({ where: { id } });
}

export async function createGift(data: {
    name: string;
    price: number;
    sortOrder: number;
    status: string;
    imageFile?: File;
}) {
    let imageUrl = "";

    if (data.imageFile && data.imageFile.size > 0) {
        const buffer = Buffer.from(await data.imageFile.arrayBuffer());
        imageUrl = await uploadFileToBunnyServer(
            buffer,
            `gift-${data.name.toLowerCase().replace(/\s+/g, "-")}.${data.imageFile.name.split(".").pop()}`,
            data.imageFile.type
        );
    }

    return prisma.gift.create({
        data: {
            name: data.name,
            image: imageUrl,
            price: data.price,
            sortOrder: data.sortOrder,
            status: data.status,
        },
    });
}

export async function updateGift(
    id: string,
    data: {
        name: string;
        price: number;
        sortOrder: number;
        status: string;
        imageFile?: File;
    }
) {
    const existing = await prisma.gift.findUnique({ where: { id } });
    if (!existing) throw new Error("Gift not found!");

    let imageUrl = existing.image;

    if (data.imageFile && data.imageFile.size > 0) {
        // Delete old image from CDN
        if (existing.image) {
            const oldFileName = existing.image.split("/").pop();
            if (oldFileName) await deleteFileFromBunny(oldFileName);
        }

        const buffer = Buffer.from(await data.imageFile.arrayBuffer());
        imageUrl = await uploadFileToBunnyServer(
            buffer,
            `gift-${data.name.toLowerCase().replace(/\s+/g, "-")}.${data.imageFile.name.split(".").pop()}`,
            data.imageFile.type
        );
    }

    return prisma.gift.update({
        where: { id },
        data: {
            name: data.name,
            image: imageUrl,
            price: data.price,
            sortOrder: data.sortOrder,
            status: data.status,
        },
    });
}

export async function deleteGift(id: string) {
    const existing = await prisma.gift.findUnique({ where: { id } });
    if (!existing) throw new Error("Gift not found!");

    // Delete image from CDN
    if (existing.image) {
        const fileName = existing.image.split("/").pop();
        if (fileName) await deleteFileFromBunny(fileName);
    }

    // Delete related post_gifts first
    await prisma.post_gift.deleteMany({ where: { giftId: id } });

    return prisma.gift.delete({ where: { id } });
}

export async function getGiftStats() {
    const [total, active, inactive, totalGiftsSent, totalRevenue] = await Promise.all([
        prisma.gift.count(),
        prisma.gift.count({ where: { status: "active" } }),
        prisma.gift.count({ where: { status: "inactive" } }),
        prisma.post_gift.count(),
        prisma.post_gift.aggregate({ _sum: { amount: true } }),
    ]);

    return {
        total,
        active,
        inactive,
        totalGiftsSent,
        totalRevenue: totalRevenue._sum.amount || 0,
    };
}
