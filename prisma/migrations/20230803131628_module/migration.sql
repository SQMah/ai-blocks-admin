/*
  Warnings:

  - The primary key for the `Enroll` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `student_id` on the `Enroll` table. All the data in the column will be lost.
  - The primary key for the `Family` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `child_id` on the `Family` table. All the data in the column will be lost.
  - You are about to drop the column `available_modules` on the `Group` table. All the data in the column will be lost.
  - The primary key for the `Manage` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `manager_id` on the `Manage` table. All the data in the column will be lost.
  - You are about to drop the column `available_modules` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id]` on the table `Enroll` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,group_id]` on the table `Enroll` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,group_id]` on the table `Family` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,group_id]` on the table `Manage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_id` to the `Enroll` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `Family` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `Manage` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Enroll" DROP CONSTRAINT "Enroll_student_id_fkey";

-- DropForeignKey
ALTER TABLE "Family" DROP CONSTRAINT "Family_child_id_fkey";

-- DropForeignKey
ALTER TABLE "Manage" DROP CONSTRAINT "Manage_manager_id_fkey";

-- DropIndex
DROP INDEX "Enroll_id_key";

-- DropIndex
DROP INDEX "Enroll_student_id_group_id_idx";

-- DropIndex
DROP INDEX "Enroll_student_id_group_id_key";

-- DropIndex
DROP INDEX "Enroll_student_id_key";

-- DropIndex
DROP INDEX "Family_child_id_group_id_idx";

-- DropIndex
DROP INDEX "Family_child_id_group_id_key";

-- DropIndex
DROP INDEX "Family_id_key";

-- DropIndex
DROP INDEX "Group_group_id_key";

-- DropIndex
DROP INDEX "Manage_id_key";

-- DropIndex
DROP INDEX "Manage_manager_id_group_id_idx";

-- DropIndex
DROP INDEX "Manage_manager_id_group_id_key";

-- DropIndex
DROP INDEX "User_user_id_key";

-- AlterTable
ALTER TABLE "Enroll" DROP CONSTRAINT "Enroll_pkey",
DROP COLUMN "student_id",
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Enroll_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Enroll_id_seq";

-- AlterTable
ALTER TABLE "Family" DROP CONSTRAINT "Family_pkey",
DROP COLUMN "child_id",
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Family_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Family_id_seq";

-- AlterTable
ALTER TABLE "Group" DROP COLUMN "available_modules";

-- AlterTable
ALTER TABLE "Manage" DROP CONSTRAINT "Manage_pkey",
DROP COLUMN "manager_id",
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Manage_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Manage_id_seq";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "available_modules";

-- CreateTable
CREATE TABLE "Module" (
    "module_id" TEXT NOT NULL,
    "module_name" TEXT NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("module_id")
);

-- CreateTable
CREATE TABLE "Student_available_module" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "Student_available_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class_available_module" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "unlocked" BOOLEAN NOT NULL,

    CONSTRAINT "Class_available_module_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Module_module_name_key" ON "Module"("module_name");

-- CreateIndex
CREATE INDEX "Module_module_name_idx" ON "Module"("module_name");

-- CreateIndex
CREATE UNIQUE INDEX "Student_available_module_module_id_user_id_key" ON "Student_available_module"("module_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Class_available_module_module_id_group_id_key" ON "Class_available_module"("module_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Enroll_user_id_key" ON "Enroll"("user_id");

-- CreateIndex
CREATE INDEX "Enroll_user_id_group_id_idx" ON "Enroll"("user_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Enroll_user_id_group_id_key" ON "Enroll"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "Family_user_id_group_id_idx" ON "Family"("user_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Family_user_id_group_id_key" ON "Family"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "Manage_user_id_group_id_idx" ON "Manage"("user_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Manage_user_id_group_id_key" ON "Manage"("user_id", "group_id");

-- AddForeignKey
ALTER TABLE "Enroll" ADD CONSTRAINT "Enroll_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manage" ADD CONSTRAINT "Manage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student_available_module" ADD CONSTRAINT "Student_available_module_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student_available_module" ADD CONSTRAINT "Student_available_module_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Module"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class_available_module" ADD CONSTRAINT "Class_available_module_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class_available_module" ADD CONSTRAINT "Class_available_module_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Module"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;
