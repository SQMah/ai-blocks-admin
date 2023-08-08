-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('unmanagedStudent', 'managedStudent', 'teacher', 'admin', 'parent');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('class', 'family');

-- CreateTable
CREATE TABLE "User" (
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "expiration_date" TEXT,
    "available_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "Group" (
    "group_id" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "type" "GroupType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "available_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Group_pkey" PRIMARY KEY ("group_id")
);

-- CreateTable
CREATE TABLE "Enroll" (
    "id" SERIAL NOT NULL,
    "student_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,

    CONSTRAINT "Enroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manage" (
    "id" SERIAL NOT NULL,
    "manager_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,

    CONSTRAINT "Manage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" SERIAL NOT NULL,
    "child_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_user_id_key" ON "User"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Group_group_id_key" ON "Group"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Enroll_id_key" ON "Enroll"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Enroll_student_id_key" ON "Enroll"("student_id");

-- CreateIndex
CREATE INDEX "Enroll_student_id_group_id_idx" ON "Enroll"("student_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Manage_id_key" ON "Manage"("id");

-- CreateIndex
CREATE INDEX "Manage_manager_id_group_id_idx" ON "Manage"("manager_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Family_id_key" ON "Family"("id");

-- CreateIndex
CREATE INDEX "Family_child_id_group_id_idx" ON "Family"("child_id", "group_id");

-- AddForeignKey
ALTER TABLE "Enroll" ADD CONSTRAINT "Enroll_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enroll" ADD CONSTRAINT "Enroll_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manage" ADD CONSTRAINT "Manage_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manage" ADD CONSTRAINT "Manage_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;
