# Prisma migrations note

This repository currently targets **PostgreSQL** (`prisma/schema.prisma` datasource provider is `postgresql`).

There is an older migration folder that was generated when the project used **SQLite**. Prisma records the expected
migration dialect in `prisma/migrations/migration_lock.toml`.

If you plan to use `prisma migrate` against PostgreSQL:

- Ensure `prisma/migrations/migration_lock.toml` has `provider = "postgresql"`.
- Consider creating a fresh baseline migration for PostgreSQL (or re-initialize migrations) if the historical SQLite SQL
  no longer matches your actual database.

