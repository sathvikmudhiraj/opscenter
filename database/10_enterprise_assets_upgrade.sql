DECLARE
  v_has_assigned_to NUMBER := 0;
  PROCEDURE add_column_if_missing(p_column VARCHAR2, p_definition VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM user_tab_columns
    WHERE table_name = 'ASSETS'
      AND column_name = UPPER(p_column);

    IF v_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE assets ADD (' || p_column || ' ' || p_definition || ')';
    END IF;
  END;

  PROCEDURE create_index_if_missing(p_name VARCHAR2, p_sql VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_indexes WHERE index_name = UPPER(p_name);
    IF v_count = 0 THEN
      EXECUTE IMMEDIATE p_sql;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE != -955 AND SQLCODE != -1408 THEN
        RAISE;
      END IF;
  END;
BEGIN
  add_column_if_missing('brand', 'VARCHAR2(120)');
  add_column_if_missing('model', 'VARCHAR2(120)');
  add_column_if_missing('serial_number', 'VARCHAR2(120)');
  add_column_if_missing('purchase_date', 'DATE');
  add_column_if_missing('warranty_expiry', 'DATE');
  add_column_if_missing('department', 'VARCHAR2(120)');
  add_column_if_missing('block', 'VARCHAR2(80)');
  add_column_if_missing('room', 'VARCHAR2(80)');
  add_column_if_missing('assigned_employee', 'NUMBER');
  add_column_if_missing('processor', 'VARCHAR2(120)');
  add_column_if_missing('ram', 'VARCHAR2(80)');
  add_column_if_missing('storage', 'VARCHAR2(120)');
  add_column_if_missing('operating_system', 'VARCHAR2(120)');
  add_column_if_missing('lifecycle_state', 'VARCHAR2(30) DEFAULT ''Available''');
  add_column_if_missing('updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

  SELECT COUNT(*) INTO v_has_assigned_to
  FROM user_tab_columns
  WHERE table_name = 'ASSETS'
    AND column_name = 'ASSIGNED_TO';

  UPDATE assets
  SET lifecycle_state = COALESCE(
        lifecycle_state,
        CASE LOWER(NVL(status, 'available'))
          WHEN 'assigned' THEN 'Assigned'
          WHEN 'repair' THEN 'Under Repair'
          WHEN 'retired' THEN 'Retired'
          ELSE 'Available'
        END
      ),
      updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);

  IF v_has_assigned_to > 0 THEN
    EXECUTE IMMEDIATE 'UPDATE assets SET assigned_employee = COALESCE(assigned_employee, assigned_to)';
  END IF;

  create_index_if_missing('idx_assets_serial_number', 'CREATE INDEX idx_assets_serial_number ON assets(serial_number)');
  create_index_if_missing('idx_assets_lifecycle_state', 'CREATE INDEX idx_assets_lifecycle_state ON assets(lifecycle_state)');
  create_index_if_missing('idx_assets_assigned_employee', 'CREATE INDEX idx_assets_assigned_employee ON assets(assigned_employee)');
  create_index_if_missing('idx_assets_warranty_expiry', 'CREATE INDEX idx_assets_warranty_expiry ON assets(warranty_expiry)');
END;
/

COMMIT;
