/*
  Warnings:

  - A unique constraint covering the columns `[student_id,group_id]` on the table `Enroll` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[child_id,group_id]` on the table `Family` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[manager_id,group_id]` on the table `Manage` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Enroll_student_id_group_id_key" ON "Enroll"("student_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Family_child_id_group_id_key" ON "Family"("child_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "Manage_manager_id_group_id_key" ON "Manage"("manager_id", "group_id");
