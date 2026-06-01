DECLARE
  v_count NUMBER;
  v_data_type USER_TAB_COLUMNS.DATA_TYPE%TYPE;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM user_tab_columns
  WHERE table_name = 'NOTIFICATIONS'
    AND column_name = 'IS_READ';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE notifications ADD (is_read CHAR(1) DEFAULT ''N'' CHECK (is_read IN (''Y'', ''N'')) NOT NULL)';
    EXECUTE IMMEDIATE 'UPDATE notifications SET is_read = CASE WHEN read_at IS NULL THEN ''N'' ELSE ''Y'' END';
  ELSE
    SELECT data_type
    INTO v_data_type
    FROM user_tab_columns
    WHERE table_name = 'NOTIFICATIONS'
      AND column_name = 'IS_READ';

    IF v_data_type NOT IN ('CHAR', 'NCHAR', 'VARCHAR2', 'NVARCHAR2') THEN
      EXECUTE IMMEDIATE 'ALTER TABLE notifications ADD (is_read_yn CHAR(1) DEFAULT ''N'' CHECK (is_read_yn IN (''Y'', ''N'')) NOT NULL)';
      EXECUTE IMMEDIATE 'UPDATE notifications SET is_read_yn = CASE WHEN NVL(is_read, 0) = 0 THEN ''N'' ELSE ''Y'' END';
      EXECUTE IMMEDIATE 'ALTER TABLE notifications DROP COLUMN is_read';
      EXECUTE IMMEDIATE 'ALTER TABLE notifications RENAME COLUMN is_read_yn TO is_read';
    ELSE
      EXECUTE IMMEDIATE 'UPDATE notifications SET is_read = CASE WHEN UPPER(TRIM(is_read)) IN (''Y'', ''1'', ''TRUE'') THEN ''Y'' ELSE ''N'' END';
    END IF;
  END IF;

  COMMIT;
END;
/
