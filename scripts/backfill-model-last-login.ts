/**
 * Backfill `model.lastLoginAt` from the MODEL_LOGIN audit log.
 *
 * Going forward both the web client and xs_backend stamp this on every
 * successful login. This fills in the history that already happened, so the
 * admin model list is usefully ordered from day one instead of after every
 * model has logged in once more.
 *
 * Only successful logins count — a wrong password is not a login.
 * Safe to re-run: it writes the same value every time.
 *
 * Run with: npx tsx scripts/backfill-model-last-login.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function backfill() {
  console.log("Backfilling model.lastLoginAt from audit logs...\n");

  const logins = await prisma.audit_logs.groupBy({
    by: ["modelId"],
    where: { action: "MODEL_LOGIN", status: "success", modelId: { not: null } },
    _max: { createdAt: true },
  });

  console.log(`Found login history for ${logins.length} model(s).`);

  let updated = 0;
  let skipped = 0;

  for (const row of logins) {
    if (!row.modelId || !row._max.createdAt) {
      skipped++;
      continue;
    }
    try {
      await prisma.model.update({
        where: { id: row.modelId },
        data: { lastLoginAt: row._max.createdAt },
      });
      updated++;
    } catch {
      // The model may have been hard-deleted since the log was written.
      skipped++;
    }
  }

  const withLogin = await prisma.model.count({
    where: { lastLoginAt: { not: null } },
  });
  const total = await prisma.model.count();

  console.log(`\nUpdated: ${updated}`);
  console.log(`Skipped: ${skipped} (missing id, or model no longer exists)`);
  console.log(`Models with a login on record: ${withLogin} of ${total}`);
}

backfill()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
