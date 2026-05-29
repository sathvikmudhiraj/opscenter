-- Optional Oracle admin baseline for local QA.
-- This script no longer creates demo employee or engineer accounts.
-- Create current engineers/employees from Admin > User Management.

MERGE INTO users target
USING (
  SELECT
    'OpsCenter Admin' AS full_name,
    'admin' AS username,
    'admin@opscenter.local' AS email,
    '$2b$12$PFCMNqO/kQMK7kl6.JvbHupTIDqm/C0h2CyVMAWP.ujXMMizI4HTG' AS password_hash,
    'admin' AS role,
    'Operations' AS department,
    'ADM-001' AS employee_id,
    'active' AS status
  FROM dual
) source
ON (LOWER(target.username) = LOWER(source.username))
WHEN MATCHED THEN UPDATE SET
  target.full_name = source.full_name,
  target.email = source.email,
  target.password_hash = source.password_hash,
  target.role = source.role,
  target.department = source.department,
  target.employee_id = source.employee_id,
  target.status = source.status,
  target.updated_at = CURRENT_TIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  full_name,
  username,
  email,
  password_hash,
  role,
  department,
  employee_id,
  status
) VALUES (
  source.full_name,
  source.username,
  source.email,
  source.password_hash,
  source.role,
  source.department,
  source.employee_id,
  source.status
);

COMMIT;
