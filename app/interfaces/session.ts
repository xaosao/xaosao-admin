export interface ISessionResponse {
  id: string;
  sessionStart: string;
  sessionEnd: string;
  duration: number;
  rate_per_minute: number;
  total_cost: number;
  sessionStatus: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string | null;

  modelId: string;
  customerId: string | null;
  modelServiceId: string | null;
  modelCallEndedById: string | null;
  customerCallEndedById: string | null;

  model: ISessionModelCustomer;
  customer: ISessionModelCustomer;
  modelService: ISessionModelService;
}

export interface ISessionModelCustomer {
  id: string;
  firstName: string;
  lastName: string;
  profile: string;
}

export interface ISessionModelService {
  id: string;
  customRate: number;
  service: ISessionService;
}

export interface ISessionService {
  id: string;
  name: string;
  description: string;
  baseRate: number;
}
