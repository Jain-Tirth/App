import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { Client } from 'pg';

const BCRYPT_ROUNDS = 12;

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const name = process.env.ADMIN_NAME?.trim() || 'Admin User';

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment before seeding an admin user.',
    );
  }

  const connectionString = process.env.DATABASE_URL;

  const client = new Client({ connectionString });
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
