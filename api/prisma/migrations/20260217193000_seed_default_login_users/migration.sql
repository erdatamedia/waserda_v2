INSERT INTO "Employee" (
  "id", "email", "name", "employeeCode", "isActive", "role", "createdAt", "updatedAt"
) VALUES
  ('6b620126-f6e8-4ca0-95ca-f2d9e2fd0af3', 'admin@waserda.local', 'Admin Waserda', 'ADM-0001', true, 'ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('29f8b6a8-2c91-4d07-a57d-fdbd42ce39ef', 'cashier@waserda.local', 'Cashier Waserda', 'CSR-0001', true, 'CASHIER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("employeeCode") DO UPDATE SET
  "isActive" = EXCLUDED."isActive",
  "role" = EXCLUDED."role",
  "name" = EXCLUDED."name",
  "updatedAt" = CURRENT_TIMESTAMP;
