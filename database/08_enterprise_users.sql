DECLARE
  PROCEDURE add_column_if_missing(p_column VARCHAR2, p_definition VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM user_tab_columns
    WHERE table_name = 'USERS'
      AND column_name = UPPER(p_column);

    IF v_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE users ADD (' || p_column || ' ' || p_definition || ')';
    END IF;
  END;
BEGIN
  add_column_if_missing('full_name', 'VARCHAR2(160)');
  add_column_if_missing('email', 'VARCHAR2(180)');
  add_column_if_missing('department', 'VARCHAR2(120)');
  add_column_if_missing('employee_id', 'VARCHAR2(80)');
  add_column_if_missing('phone', 'VARCHAR2(40)');
  add_column_if_missing('status', 'VARCHAR2(20) DEFAULT ''active''');
  add_column_if_missing('updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
END;
/

UPDATE users
SET full_name = COALESCE(full_name, username),
    status = COALESCE(status, 'active'),
    updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);

BEGIN
  EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX ux_users_username ON users(username)';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -955 THEN
      RAISE;
    END IF;
END;
/

COMMIT;
