/*
  Warnings:

  - You are about to drop the `Class_available_module` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Enroll` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Family` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Manage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Module` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Student_available_module` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Class_available_module" DROP CONSTRAINT "Class_available_module_group_id_fkey";

-- DropForeignKey
ALTER TABLE "Class_available_module" DROP CONSTRAINT "Class_available_module_module_id_fkey";

-- DropForeignKey
ALTER TABLE "Enroll" DROP CONSTRAINT "Enroll_group_id_fkey";

-- DropForeignKey
ALTER TABLE "Enroll" DROP CONSTRAINT "Enroll_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Family" DROP CONSTRAINT "Family_group_id_fkey";

-- DropForeignKey
ALTER TABLE "Family" DROP CONSTRAINT "Family_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Manage" DROP CONSTRAINT "Manage_group_id_fkey";

-- DropForeignKey
ALTER TABLE "Manage" DROP CONSTRAINT "Manage_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Student_available_module" DROP CONSTRAINT "Student_available_module_module_id_fkey";

-- DropForeignKey
ALTER TABLE "Student_available_module" DROP CONSTRAINT "Student_available_module_user_id_fkey";

-- DropTable
DROP TABLE "Class_available_module";

-- DropTable
DROP TABLE "Enroll";

-- DropTable
DROP TABLE "Family";

-- DropTable
DROP TABLE "Group";

-- DropTable
DROP TABLE "Manage";

-- DropTable
DROP TABLE "Module";

-- DropTable
DROP TABLE "Student_available_module";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "GroupAvailableModules" (
    "id" SERIAL NOT NULL,
    "module_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "unlocked" BOOLEAN NOT NULL,
    "number_of_completion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GroupAvailableModules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentModuleProgress" (
    "user_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "pages_compeleted" TEXT[],
    "completed_time" TIMESTAMP(3),
    "last_modified_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentModuleProgress_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "Enrolls" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,

    CONSTRAINT "Enrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Families" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,

    CONSTRAINT "Families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Groups" (
    "group_id" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "type" "GroupType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "student_count" INTEGER NOT NULL,
    "student_last_modified_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module_last_modified_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Groups_pkey" PRIMARY KEY ("group_id")
);

-- CreateTable
CREATE TABLE "Manages" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,

    CONSTRAINT "Manages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modules" (
    "module_id" TEXT NOT NULL,
    "module_name" TEXT NOT NULL,

    CONSTRAINT "Modules_pkey" PRIMARY KEY ("module_id")
);

-- CreateTable
CREATE TABLE "StudentAvailableModules" (
    "id" SERIAL NOT NULL,
    "module_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "StudentAvailableModules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Users" (
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "expiration_date" TIMESTAMP(3),

    CONSTRAINT "Users_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "GroupAvailableModules_group_id_idx" ON "GroupAvailableModules" USING HASH ("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "GroupAvailableModules_module_id_group_id_key" ON "GroupAvailableModules"("module_id", "group_id");

-- CreateIndex
CREATE INDEX "StudentModuleProgress_module_id_idx" ON "StudentModuleProgress" USING HASH ("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "Enrolls_user_id_key" ON "Enrolls"("user_id");

-- CreateIndex
CREATE INDEX "Enrolls_group_id_idx" ON "Enrolls" USING HASH ("group_id");

-- CreateIndex
CREATE INDEX "Enrolls_id_idx" ON "Enrolls"("id");

-- CreateIndex
CREATE INDEX "Enrolls_user_id_idx" ON "Enrolls" USING HASH ("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Enrolls_user_id_group_id_key" ON "Enrolls"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "Families_group_id_idx" ON "Families" USING HASH ("group_id");

-- CreateIndex
CREATE INDEX "Families_id_idx" ON "Families"("id");

-- CreateIndex
CREATE INDEX "Families_user_id_idx" ON "Families" USING HASH ("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Families_user_id_group_id_key" ON "Families"("user_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Groups_group_name_key" ON "Groups"("group_name");

-- CreateIndex
CREATE INDEX "Groups_group_name_idx" ON "Groups" USING HASH ("group_name");

-- CreateIndex
CREATE INDEX "Manages_group_id_idx" ON "Manages" USING HASH ("group_id");

-- CreateIndex
CREATE INDEX "Manages_id_idx" ON "Manages"("id");

-- CreateIndex
CREATE INDEX "Manages_user_id_idx" ON "Manages" USING HASH ("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Manages_user_id_group_id_key" ON "Manages"("user_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Modules_module_name_key" ON "Modules"("module_name");

-- CreateIndex
CREATE INDEX "Modules_module_name_idx" ON "Modules" USING HASH ("module_name");

-- CreateIndex
CREATE INDEX "StudentAvailableModules_user_id_idx" ON "StudentAvailableModules" USING HASH ("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAvailableModules_module_id_user_id_key" ON "StudentAvailableModules"("module_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- CreateIndex
CREATE INDEX "Users_email_idx" ON "Users" USING HASH ("email");

-- AddForeignKey
ALTER TABLE "GroupAvailableModules" ADD CONSTRAINT "GroupAvailableModules_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Groups"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAvailableModules" ADD CONSTRAINT "GroupAvailableModules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentModuleProgress" ADD CONSTRAINT "StudentModuleProgress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentModuleProgress" ADD CONSTRAINT "StudentModuleProgress_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolls" ADD CONSTRAINT "Enrolls_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Groups"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolls" ADD CONSTRAINT "Enrolls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Families" ADD CONSTRAINT "Families_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Groups"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Families" ADD CONSTRAINT "Families_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manages" ADD CONSTRAINT "Manages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Groups"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manages" ADD CONSTRAINT "Manages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAvailableModules" ADD CONSTRAINT "StudentAvailableModules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAvailableModules" ADD CONSTRAINT "StudentAvailableModules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
