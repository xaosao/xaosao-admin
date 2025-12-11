export interface IConversationResponse {
  id: string;
  status: string;
  lastMessage: string;
  createdAt: string;
  model: IConversationModel;
  customer: IConversationCustomer;
}

export interface IConversationCustomer {
  id: string;
  status: string;
  firstName: string;
  lastName: string;
  profile: string;
}

export interface IConversationModel extends IConversationCustomer {
  dob: string;
}

export interface IConversationStats {
  title: string;
  value: string;
  icon: string;
  color: string;
}

// ==================== Chat session types:
export interface IChatCustomerRes extends IConversationCustomer {
  whatsapp: number;
}

export interface IChatModelRes extends IChatCustomerRes {
  rating: number;
}

export interface IChatConversation {
  id: string;
  status: string;
  lastMessage: string;
  createdAt: string;
}

export interface IChatMessage {
  messageText: string;
  sendAt: string;
}

export interface IChatMessageResponse {
  id: string;
  sessionStart: string;
  sessionEnd: string;
  duration: number;
  ratePerMinute: string;
  totalCost: number;
  sessionStatus: string;
  paymentStatus: string;
  createdAt: string;
  customer: IChatCustomerRes;
  model: IChatModelRes;
  conversation: IChatConversation;
  messages: IChatMessage;
  _count: {
    messages: number;
  };
}

export interface IChatSessionResponse extends IChatMessageResponse {
  conversation: IChatConversation;
}

export interface IMessageResponse {
  id: string;
  sender: string;
  senderType: string;
  messageText: string;
  messageType: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  isRead: boolean;
  isDeleted: boolean;
  replyToMessageId?: string;
  sendAt: string;
  senderInfo: ISender;
}

export interface ISender {
  firstName: string;
  lastName?: string;
  profile?: string;
}
