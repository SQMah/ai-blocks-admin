/*
  Warnings:

  - A unique constraint covering the columns `[group_name]` on the table `Group` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Group_group_name_key" ON "Group"("group_name");

-- CreateIndex
CREATE INDEX "Group_group_name_idx" ON "Group"("group_name");
