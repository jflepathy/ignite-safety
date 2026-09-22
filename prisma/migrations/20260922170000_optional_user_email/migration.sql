-- Make User.email optional. A unique index already exists on this column
-- (Postgres treats multiple NULLs as distinct, so no index change needed);
-- this just drops the NOT NULL constraint.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
