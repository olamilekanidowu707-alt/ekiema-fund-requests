-- AlterTable
ALTER TABLE "FundRequest" ADD COLUMN     "accountName" TEXT,
ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "documentData" BYTEA,
ADD COLUMN     "documentName" TEXT,
ADD COLUMN     "documentType" TEXT;
