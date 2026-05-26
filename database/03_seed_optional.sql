-- Optional seed data after creating the first admin through /setup-admin.
-- Passwords are intentionally omitted because auth users should be created through the API.

INSERT INTO assets (
  asset_tag, asset_name, category, type, brand, model, serial_number,
  status, department, block, room, location, purchase_date, warranty_expiry,
  processor, ram, storage, operating_system
)
VALUES (
  'LAP-OPS-1001', 'Operations Laptop 1001', 'Laptop', 'Laptop', 'Lenovo', 'ThinkPad T14', 'SN-LAP-1001',
  'available', 'Operations', 'A', '101', 'Operations / Block A / Room 101', DATE '2025-04-01', DATE '2028-04-01',
  'Intel Core i7', '16 GB', '512 GB SSD', 'Windows 11 Pro'
);

INSERT INTO assets (
  asset_tag, asset_name, category, type, brand, model, serial_number,
  status, department, block, room, location, purchase_date, warranty_expiry,
  processor, ram, storage, operating_system
)
VALUES (
  'MON-OPS-2104', 'Finance Display 2104', 'Monitor', 'Monitor', 'Dell', 'P2424H', 'SN-MON-2104',
  'available', 'Finance', 'B', '204', 'Finance / Block B / Room 204', DATE '2024-10-12', DATE '2027-10-12',
  'N/A', 'N/A', 'N/A', 'N/A'
);

COMMIT;
