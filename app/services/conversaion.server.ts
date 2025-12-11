import { FieldValidationError } from "./admin.server";
import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";

function isValidObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

export async function getConversations(
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
      if (isValidObjectId(search)) {
        whereClause.OR = [{ modelId: search }, { customerId: search }];
      } else {
        whereClause.OR = [
          { model: { firstName: { contains: search, mode: "insensitive" } } },
          { model: { lastName: { contains: search, mode: "insensitive" } } },
          {
            customer: {
              firstName: { contains: search, mode: "insensitive" },
            },
          },
          {
            customer: { lastName: { contains: search, mode: "insensitive" } },
          },
        ];
      }
    }

    if (status && status !== "all") {
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
    const [conversations, totalCount] = await Promise.all([
      prisma.conversation.findMany({
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          status: true,
          lastMessage: true,
          createdAt: true,
          model: {
            select: {
              id: true,
              dob: true,
              status: true,
              firstName: true,
              lastName: true,
              profile: true,
            },
          },
          customer: {
            select: {
              id: true,
              status: true,
              firstName: true,
              lastName: true,
              profile: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.conversation.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      conversations,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPreviousPage,
        limit,
      },
    };
  } catch (error: any) {
    console.error("GET_CONVERSATIONS_FAILED", error);
    throw new Error("Failed to fetch conversations!");
  }
}

export async function getConversation(id: string) {
  if (!id)
    throw new FieldValidationError({
      id: "Conversation ID is required!",
    });

  try {
    const chat_session = await prisma.chat_session.findMany({
      where: { conversationId: id },
      select: {
        id: true,
        sessionStart: true,
        sessionEnd: true,
        duration: true,
        ratePerMinute: true,
        totalCost: true,
        sessionStatus: true,
        paymentStatus: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            status: true,
            whatsapp: true,
            firstName: true,
            lastName: true,
            profile: true,
          },
        },
        model: {
          select: {
            id: true,
            status: true,
            whatsapp: true,
            rating: true,
            firstName: true,
            lastName: true,
            profile: true,
          },
        },
        conversation: {
          select: {
            id: true,
            status: true,
            lastMessage: true,
            createdAt: true,
          },
        },
        messages: {
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            messageText: true,
            sendAt: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });
    return chat_session;
  } catch (error: any) {
    console.log("FETCH_CONVERSATION_DATA_FAILED", error);
    throw new FieldValidationError({
      id: "Failed to fetch conversation data!",
    });
  }
}

export async function getChatSessionDetail(id: string) {
  if (!id)
    throw new FieldValidationError({
      id: "Chat session ID is required!",
    });

  try {
    const chat_session = await prisma.chat_session.findFirst({
      where: { id },
      select: {
        id: true,
        sessionStart: true,
        sessionEnd: true,
        duration: true,
        ratePerMinute: true,
        totalCost: true,
        sessionStatus: true,
        paymentStatus: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            status: true,
            whatsapp: true,
            firstName: true,
            lastName: true,
            profile: true,
          },
        },
        model: {
          select: {
            id: true,
            status: true,
            whatsapp: true,
            rating: true,
            firstName: true,
            lastName: true,
            profile: true,
          },
        },
        conversation: {
          select: {
            id: true,
            status: true,
            lastMessage: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });
    return chat_session;
  } catch (error: any) {
    console.log("FETCH_CHAT_SESSION_DATA_FAILED", error);
    throw new FieldValidationError({
      id: "Failed to fetch chat session data!",
    });
  }
}

export async function getChatSessionMessages(
  options: {
    id?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  try {
    const { id = "", page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    // Step 1: Fetch raw messages
    const [messages, totalCount] = await Promise.all([
      prisma.messages.findMany({
        where: { chatSessionId: id },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
        select: {
          id: true,
          sender: true,
          senderType: true,
          messageText: true,
          messageType: true,
          fileUrl: true,
          fileName: true,
          fileSize: true,
          isRead: true,
          isDeleted: true,
          replyToMessageId: true,
          sendAt: true,
        },
      }),
      prisma.messages.count({ where: { chatSessionId: id } }),
    ]);

    // Step 2: Extract unique sender IDs by type
    const customerSenderIds = messages
      .filter((m) => m.senderType === "customer")
      .map((m) => m.sender!);
    const modelSenderIds = messages
      .filter((m) => m.senderType === "model")
      .map((m) => m.sender!);

    // Step 3: Fetch customer and model info
    const [customers, models] = await Promise.all([
      prisma.customer.findMany({
        where: { id: { in: customerSenderIds } },
        select: { id: true, firstName: true, lastName: true, profile: true },
      }),
      prisma.model.findMany({
        where: { id: { in: modelSenderIds } },
        select: { id: true, firstName: true, lastName: true, profile: true },
      }),
    ]);

    // Step 4: Index them by ID
    const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));
    const modelMap = Object.fromEntries(models.map((m) => [m.id, m]));

    // Step 5: Enrich messages
    const enrichedMessages = messages.map((msg) => {
      const senderInfo =
        msg.senderType === "customer"
          ? customerMap[msg.sender!]
          : modelMap[msg.sender!];

      return {
        ...msg,
        senderInfo: senderInfo
          ? {
              firstName: senderInfo.firstName,
              lastName: senderInfo.lastName,
              profile: senderInfo.profile,
            }
          : null,
      };
    });

    return {
      messages: enrichedMessages,
      totalCount,
    };
  } catch (error) {
    console.log("FETCH_CHAT_MESSAGE_DATA_FAILED", error);
    throw new Error("Failed to get chat session messages!");
  }
}

export async function getConversationStats() {
  try {
    const [total, active, archived, blocked] = await Promise.all([
      prisma.conversation.count(),
      prisma.conversation.count({
        where: { status: "active" },
      }),
      prisma.conversation.count({
        where: { status: "archived" },
      }),
      prisma.conversation.count({
        where: { status: "blocked" },
      }),
    ]);

    const format = (val: number) => new Intl.NumberFormat("en-US").format(val);

    const conversationStuts = [
      {
        title: "Total Conversations",
        value: format(total),
        icon: "MessageCircle",
        color: "text-blue-600",
      },
      {
        title: "Active Conversations",
        value: format(active),
        icon: "MessageCircleMore",
        color: "text-green-600",
      },
      {
        title: "Archived Conversations",
        value: format(archived),
        icon: "MessageCircleOff",
        color: "text-orange-600",
      },
      {
        title: "Block Conversations",
        value: format(blocked),
        icon: "MessageSquareLock",
        color: "text-red-600",
      },
    ];

    return conversationStuts;
  } catch (err) {
    console.error("FETCH_CONVERSATION_STATS_FAILED", err);
    throw new Error("Failed to get conversation status!");
  }
}

export async function deleteConversation(id: string, userId: string) {
  if (!id || !userId) throw new Error("Missing conversation delete data!");
  const auditBase = {
    action: "DELETE_CONVERSATION",
    user: userId,
  };
  try {
    const conversation = await prisma.conversation.delete({
      where: { id },
    });

    if (conversation.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Delete conversation: ${conversation.id} successfully.`,
        status: "success",
        onSuccess: conversation,
      });
    }
    return conversation;
  } catch (error) {
    console.log("DELETE_CONVERSATION_DATA_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Delete conversation failed!`,
      status: "failed",
      onSuccess: error,
    });
    throw new FieldValidationError({
      id: "Delete conversation failed! Try again later!",
    });
  }
}
