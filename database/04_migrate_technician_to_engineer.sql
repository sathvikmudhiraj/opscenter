UPDATE users
SET role = 'engineer'
WHERE role = 'technician';

DECLARE
  v_constraint_name USER_CONSTRAINTS.CONSTRAINT_NAME%TYPE;
BEGIN
  SELECT uc.constraint_name
  INTO v_constraint_name
  FROM user_constraints uc
  JOIN user_cons_columns ucc ON ucc.constraint_name = uc.constraint_name
  WHERE uc.table_name = 'USERS'
    AND ucc.column_name = 'ROLE'
    AND uc.constraint_type = 'C'
    AND LOWER(uc.search_condition_vc) LIKE '%technician%'
  FETCH FIRST 1 ROWS ONLY;

  EXECUTE IMMEDIATE 'ALTER TABLE users DROP CONSTRAINT ' || v_constraint_name;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    NULL;
END;
/

ALTER TABLE users ADD CONSTRAINT chk_users_role
CHECK (role IN ('employee', 'engineer', 'admin'));

COMMIT;
