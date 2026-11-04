-- Runs once, when the data volume is first created.
-- The image already creates yerevan_dev from POSTGRES_DB, so only the test database is needed here.
CREATE DATABASE yerevan_test;
