-- Real authentication: login by email + bcrypt password hash.
-- (Applied on an emptied demo database — the columns are NOT NULL from the start.)

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
