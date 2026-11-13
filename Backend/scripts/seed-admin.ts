import * as bcrypt from 'bcrypt';
import { Client } from 'pg';
import { env } from '../src/config/env';

const BCRYPT_ROUNDS = 12;

async function main() {
  const email = env.admin.email.trim().toLowerCase();
  const password = env.admin.password.trim();
  const name = env.admin.name.trim() || 'Admin User';

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment before seeding an admin user.',
    );
  }

  const client = new Client({ connectionString: env.databaseUrl });
  await client.connect();

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const mobile = `A${Date.now().toString().slice(-14)}`;

    const res = await client.query(
      'SELECT fn_seed_admin_user($1, $2, $3, $4) AS id',
      [name, email, passwordHash, mobile],
    );

    const adminId = res.rows[0]?.id;
    console.log(`Admin user ready: ${email} (${adminId})`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
