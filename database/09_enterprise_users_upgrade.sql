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

  PROCEDURE add_constraint_if_missing(p_name VARCHAR2, p_sql VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_constraints WHERE constraint_name = UPPER(p_name);
    IF v_count = 0 THEN
      EXECUTE IMMEDIATE p_sql;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE != -2261 AND SQLCODE != -955 THEN
        RAISE;
      END IF;
  END;

  PROCEDURE modify_column_if_safe(p_column VARCHAR2, p_definition VARCHAR2, p_target_length NUMBER) IS
    v_max_length NUMBER;
  BEGIN
    EXECUTE IMMEDIATE 'SELECT NVL(MAX(LENGTH(' || p_column || ')), 0) FROM users' INTO v_max_length;
    IF v_max_length <= p_target_length THEN
      EXECUTE IMMEDIATE 'ALTER TABLE users MODIFY (' || p_column || ' ' || p_definition || ')';
    END IF;
  END;
BEGIN
  add_column_if_missing('username', 'VARCHAR2(100)');
  add_column_if_missing('full_name', 'VARCHAR2(150)');
  add_column_if_missing('email', 'VARCHAR2(255)');
  add_column_if_missing('department', 'VARCHAR2(100)');
  add_column_if_missing('employee_id', 'VARCHAR2(50)');
  add_column_if_missing('phone', 'VARCHAR2(20)');
  add_column_if_missing('status', 'VARCHAR2(20) DEFAULT ''ACTIVE''');
  add_column_if_missing('updated_at', 'TIMESTAMP');

  modify_column_if_safe('full_name', 'VARCHAR2(150)', 150);
  modify_column_if_safe('email', 'VARCHAR2(255)', 255);
  modify_column_if_safe('department', 'VARCHAR2(100)', 100);
  modify_column_if_safe('employee_id', 'VARCHAR2(50)', 50);
  modify_column_if_safe('phone', 'VARCHAR2(20)', 20);

  EXECUTE IMMEDIATE q'[
    UPDATE users
    SET username = COALESCE(username, LOWER(email), 'user' || id),
        full_name = COALESCE(full_name, username, email, 'User ' || id),
        email = COALESCE(email, LOWER(COALESCE(username, 'user' || id)) || '@opscenter.local'),
        employee_id = COALESCE(employee_id, 'USR-' || TO_CHAR(id)),
        status = COALESCE(status, 'ACTIVE'),
        updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
  ]';

  create_index_if_missing('ix_users_username', 'CREATE INDEX ix_users_username ON users(username)');
  create_index_if_missing('ix_users_email', 'CREATE INDEX ix_users_email ON users(email)');
  create_index_if_missing('ix_users_employee_id', 'CREATE INDEX ix_users_employee_id ON users(employee_id)');

  add_constraint_if_missing('uk_users_email', 'ALTER TABLE users ADD CONSTRAINT uk_users_email UNIQUE (email)');
  add_constraint_if_missing('uk_users_employee_id', 'ALTER TABLE users ADD CONSTRAINT uk_users_employee_id UNIQUE (employee_id)');
END;
/

COMMIT;
