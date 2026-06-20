-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ANGAJAT', 'SEF_IERARHIC', 'ACHIZITII', 'DIR_ECONOMIC', 'DIR_GENERAL');

-- CreateEnum
CREATE TYPE "ReferatStatus" AS ENUM ('IN_ASTEPTARE', 'APROBAT', 'RESPINS', 'TRIMIS_INAPOI', 'FINALIZAT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'WAITING', 'APPROVED', 'REJECTED', 'SENT_BACK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referat" (
    "id" TEXT NOT NULL,
    "articol" TEXT NOT NULL,
    "cantitate" INTEGER NOT NULL,
    "justificare" TEXT NOT NULL,
    "centruCost" TEXT NOT NULL,
    "valoareLei" INTEGER NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "ReferatStatus" NOT NULL DEFAULT 'IN_ASTEPTARE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalTask" (
    "id" TEXT NOT NULL,
    "referatId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "effectiveApproverId" TEXT,
    "actedById" TEXT,
    "actedAt" TIMESTAMP(3),
    "comment" TEXT,

    CONSTRAINT "ApprovalTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transition" (
    "id" TEXT NOT NULL,
    "referatId" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalTask_role_status_idx" ON "ApprovalTask"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalTask_referatId_stepOrder_key" ON "ApprovalTask"("referatId", "stepOrder");

-- CreateIndex
CREATE INDEX "Transition_referatId_createdAt_idx" ON "Transition"("referatId", "createdAt");

-- AddForeignKey
ALTER TABLE "Referat" ADD CONSTRAINT "Referat_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTask" ADD CONSTRAINT "ApprovalTask_referatId_fkey" FOREIGN KEY ("referatId") REFERENCES "Referat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTask" ADD CONSTRAINT "ApprovalTask_effectiveApproverId_fkey" FOREIGN KEY ("effectiveApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTask" ADD CONSTRAINT "ApprovalTask_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transition" ADD CONSTRAINT "Transition_referatId_fkey" FOREIGN KEY ("referatId") REFERENCES "Referat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transition" ADD CONSTRAINT "Transition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
