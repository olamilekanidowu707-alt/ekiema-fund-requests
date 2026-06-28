export type FundRequestStatus =
  | "PENDING_MANAGER"
  | "PENDING_ACCOUNTANT"
  | "PAID"
  | "REJECTED_BY_MANAGER"
  | "REJECTED_BY_ACCOUNTANT";

export interface FundRequest {
  id: string;
  requesterId: string;
  requester?: { id: string; name: string; email: string };
  amount: string;
  currency: string;
  purpose: string;
  description: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  documentName: string | null;
  documentType: string | null;
  status: FundRequestStatus;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalEvent {
  id: string;
  action: string;
  comment: string | null;
  createdAt: string;
  actor: { id: string; name: string; role: string };
}

export interface FundRequestDetail extends FundRequest {
  approvalEvents: ApprovalEvent[];
}
