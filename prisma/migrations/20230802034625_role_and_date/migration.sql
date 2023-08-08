/*
  Warnings:

  - The values [unmanagedStudent,managedStudent] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - The `expiration_date` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('student', 'teacher', 'admin', 'parent');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "expiration_date",
ADD COLUMN     "expiration_date" TIMESTAMP(3);
