import { decrypt } from '@/lib/crypto';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  const rows = await sql`SELECT kubeconfig FROM clusters WHERE name='aws-dev'`;
  if (rows[0]?.kubeconfig) {
    const decrypted = decrypt(rows[0].kubeconfig);
    console.log(decrypted);
  }
  await sql.end();
}
main();
