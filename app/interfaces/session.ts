export interface ISessionResponse {
  id: string;
  sessionStart: string;
  sessionEnd: string;
  duration: number;
  /**
   * What `toSessionRow` actually produces. The snake_case pair below is
   * the older naming some screens still reference; both are declared so
   * a rename does not silently render blanks the way it did on the call
   * list, where the page read `total_cost` and the row carried
   * `totalCost`.
   */
  ratePerMinute: number;
  totalCost: number;
  rate_per_minute?: number;
  total_cost?: number;
  /** Null until both sides actually joined — no connection, no duration. */
  connectedAt: string | null;
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
