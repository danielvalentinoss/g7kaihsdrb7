import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("❌ SUPABASE_URL atau SUPABASE_SECRET_KEY belum tersedia.");
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY
);

const PASSWORD = "123456";

function makeEmail(prefix, id) {
  return `${prefix}-${id}@g7kai.local`;
}

async function getAll(table) {
  const { data, error } = await supabase
    .from(table)
    .select("*");

  if (error) throw error;

  return data || [];
}

async function provisionAccounts(table, prefix) {
  const rows = await getAll(table);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    const email = makeEmail(prefix, row.id);

    try {
      const { data: usersData, error: usersError } =
        await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

      if (usersError) throw usersError;

      const existing = usersData.users.find(
        (u) => u.email === email
      );

      let authUser;

      if (existing) {
        const { data, error } =
          await supabase.auth.admin.updateUserById(
            existing.id,
            {
              password: PASSWORD,
              email_confirm: true,
            }
          );

        if (error) throw error;

        authUser = data.user;
        updated++;
      } else {
        const { data, error } =
          await supabase.auth.admin.createUser({
            email,
            password: PASSWORD,
            email_confirm: true,
          });

        if (error) throw error;

        authUser = data.user;
        created++;
      }

      const { error: updateError } = await supabase
        .from(table)
        .update({
          auth_user_id: authUser.id,
          auth_email: email,
        })
        .eq("id", row.id);

      if (updateError) throw updateError;

    } catch (error) {
      failed++;
      console.error(
        `❌ Gagal ${table} ${row.username || row.name}:`,
        error.message
      );
    }
  }

  console.log(
    `\n${table}: ${rows.length} data | dibuat: ${created} | diperbarui: ${updated} | gagal: ${failed}`
  );
}

async function main() {
  console.log("====================================");
  console.log(" G7KAI SUPABASE AUTH PROVISIONING");
  console.log("====================================");

  await provisionAccounts("students", "siswa");
  await provisionAccounts("teachers", "guru");
  await provisionAccounts("admin_accounts", "admin");
  await provisionAccounts("principal_accounts", "kepala");

  console.log("\n====================================");
  console.log("✅ PROVISIONING SELESAI");
  console.log("====================================");
}

main().catch((error) => {
  console.error("\n❌ ERROR:");
  console.error(error);
  process.exit(1);
});