/*
  Warnings:

  - You are about to drop the `Families` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StudentAvailableModules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StudentModuleProgress` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Families" DROP CONSTRAINT "Families_group_id_fkey";

-- DropForeignKey
ALTER TABLE "Families" DROP CONSTRAINT "Families_user_id_fkey";

-- DropForeignKey
ALTER TABLE "StudentAvailableModules" DROP CONSTRAINT "StudentAvailableModules_module_id_fkey";

-- DropForeignKey
ALTER TABLE "StudentAvailableModules" DROP CONSTRAINT "StudentAvailableModules_user_id_fkey";

-- DropForeignKey
ALTER TABLE "StudentModuleProgress" DROP CONSTRAINT "StudentModuleProgress_module_id_fkey";

-- DropForeignKey
ALTER TABLE "StudentModuleProgress" DROP CONSTRAINT "StudentModuleProgress_user_id_fkey";

-- DropTable
DROP TABLE "Families";

-- DropTable
DROP TABLE "StudentAvailableModules";

-- DropTable
DROP TABLE "StudentModuleProgress";

-- CreateTable
CREATE TABLE "UserModuleProgress" (
    "user_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "pages_completed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completed_time" TIMESTAMP(3),
    "last_modified_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserModuleProgress_pkey" PRIMARY KEY ("user_id","module_id")
);

-- CreateTable
CREATE TABLE "UserAvailableModules" (
    "id" SERIAL NOT NULL,
    "module_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "UserAvailableModules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserModuleProgress_module_id_idx" ON "UserModuleProgress" USING HASH ("module_id");

-- CreateIndex
CREATE INDEX "UserModuleProgress_user_id_idx" ON "UserModuleProgress" USING HASH ("user_id");

-- CreateIndex
CREATE INDEX "UserAvailableModules_user_id_idx" ON "UserAvailableModules" USING HASH ("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserAvailableModules_module_id_user_id_key" ON "UserAvailableModules"("module_id", "user_id");

-- CreateIndex
CREATE INDEX "GroupAvailableModules_module_id_idx" ON "GroupAvailableModules" USING HASH ("module_id");

-- AddForeignKey
ALTER TABLE "UserModuleProgress" ADD CONSTRAINT "UserModuleProgress_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModuleProgress" ADD CONSTRAINT "UserModuleProgress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAvailableModules" ADD CONSTRAINT "UserAvailableModules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAvailableModules" ADD CONSTRAINT "UserAvailableModules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
