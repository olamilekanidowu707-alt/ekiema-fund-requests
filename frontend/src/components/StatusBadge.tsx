import type { FundRequestStatus } from "../types";

const LABELS: Record<FundRequestStatus, string> = {
  PENDING_MANAGER: "Pending Manager",
  PENDING_ACCOUNTANT: "Pending Accountant",
  PAID: "Paid",
  REJECTED_BY_MANAGER: "Rejected by Manager",
  REJECTED_BY_ACCOUNTANT: "Rejected by Accountant",
};

function classFor(status: FundRequestStatus) {
  if (status === "PAID") return "badge paid";
  if (status.startsWith("REJECTED")) return "badge rejected";
  return "badge pending";
}

export function StatusBadge({ status }: { status: FundRequestStatus }) {
  return <span className={classFor(status)}>{LABELS[status]}</span>;
}
