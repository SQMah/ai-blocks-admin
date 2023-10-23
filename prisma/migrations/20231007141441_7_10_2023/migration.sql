/*
  Warnings:

  - The primary key for the `Enroll` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Enroll` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Family` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Family` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Manage` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Manage` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `student_count` to the `Group` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Enroll_user_id_group_id_idx";

-- DropIndex
DROP INDEX "Family_user_id_group_id_idx";

-- DropIndex
DROP INDEX "Group_group_name_idx";

-- DropIndex
DROP INDEX "Manage_user_id_group_id_idx";

-- DropIndex
DROP INDEX "Module_module_name_idx";

-- DropIndex
DROP INDEX "User_email_idx";

-- AlterTable
ALTER TABLE "Enroll" DROP CONSTRAINT "Enroll_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Enroll_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Family" DROP CONSTRAINT "Family_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Family_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "last_modified_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "student_count" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Manage" DROP CONSTRAINT "Manage_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Manage_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "Enroll_id_idx" ON "Enroll"("id");

-- CreateIndex
CREATE INDEX "Enroll_group_id_idx" ON "Enroll" USING HASH ("group_id");

-- CreateIndex
CREATE INDEX "Enroll_user_id_idx" ON "Enroll" USING HASH ("user_id");

-- CreateIndex
CREATE INDEX "Family_id_idx" ON "Family"("id");

-- CreateIndex
CREATE INDEX "Family_group_id_idx" ON "Family" USING HASH ("group_id");

-- CreateIndex
CREATE INDEX "Family_user_id_idx" ON "Family" USING HASH ("user_id");

-- CreateIndex
CREATE INDEX "Group_group_name_idx" ON "Group" USING HASH ("group_name");

-- CreateIndex
CREATE INDEX "Manage_group_id_idx" ON "Manage" USING HASH ("group_id");

-- CreateIndex
CREATE INDEX "Manage_user_id_idx" ON "Manage" USING HASH ("user_id");

-- CreateIndex
CREATE INDEX "Module_module_name_idx" ON "Module" USING HASH ("module_name");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User" USING HASH ("email");
