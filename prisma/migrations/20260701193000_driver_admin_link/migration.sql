-- Link an admin login to a driver profile without changing existing records.
DO $$ BEGIN
    ALTER TABLE "Driver"
    ADD COLUMN "adminId" TEXT;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Driver_adminId_key" ON "Driver"("adminId");

DO $$ BEGIN
    ALTER TABLE "Driver"
    ADD CONSTRAINT "Driver_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "Admin"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;
