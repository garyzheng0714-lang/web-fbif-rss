CREATE TYPE "SourcePriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

ALTER TABLE "FeedSource"
ADD COLUMN "priority" "SourcePriority" NOT NULL DEFAULT 'MEDIUM';
