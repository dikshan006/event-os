-- Velvet Botanical.
--
-- Adding a value to an enum is additive and non-blocking: no existing row is
-- read or rewritten, and every wedding keeps the template it already has. It
-- is also the one enum operation Postgres cannot roll back inside a
-- transaction, which is why it stands alone in its own migration with nothing
-- else that could fail alongside it.
ALTER TYPE "TemplateKey" ADD VALUE IF NOT EXISTS 'VELVET_BOTANICAL';
