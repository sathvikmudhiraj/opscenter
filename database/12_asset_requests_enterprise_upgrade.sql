-- Enterprise Asset Request Management upgrade.
-- Safe to run multiple times. Preserves existing asset request data.

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM user_tab_columns
  WHERE table_name = 'ASSET_REQUESTS'
    AND column_name = 'JUSTIFICATION';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE asset_requests ADD (justification VARCHAR2(1000))';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM user_tab_columns
  WHERE table_name = 'ASSET_REQUESTS'
    AND column_name = 'APPROVED_BY';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE asset_requests ADD (approved_by NUMBER)';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM user_tab_columns
  WHERE table_name = 'ASSET_REQUESTS'
    AND column_name = 'UPDATED_AT';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE asset_requests ADD (updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)';
    EXECUTE IMMEDIATE 'UPDATE asset_requests SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL';
  END IF;
END;
/

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM user_constraints
  WHERE table_name = 'ASSET_REQUESTS'
    AND constraint_name = 'FK_ASSET_REQUESTS_APPROVED_BY';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE asset_requests ADD CONSTRAINT fk_asset_requests_approved_by FOREIGN KEY (approved_by) REFERENCES users(id)';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -2264 AND SQLCODE != -2275 THEN
      RAISE;
    END IF;
END;
/
