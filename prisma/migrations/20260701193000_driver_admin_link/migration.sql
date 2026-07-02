-- Link an admin login to a driver profile without changing existing records.
ALTER TABLE "Driver"
ADD COLUMN "adminId" TEXT;

CREATE UNIQUE INDEX "Driver_adminId_key" ON "Driver"("adminId");

ALTER TABLE "Driver"
ADD CONSTRAINT "Driver_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "Admin"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
