// Database verification script to query row counts in Neon
import pg from 'pg';

const { Client } = pg;
const neonConnectionString = 'postgresql://neondb_owner:npg_9EBoxFjQgZ5U@ep-floral-thunder-aosbcmz9.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pgClient = new Client({
  connectionString: neonConnectionString,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  try {
    await pgClient.connect();
    console.log('Connected to Neon PostgreSQL.');

    const tables = ['businesses', 'folders', 'registers', 'columns', 'entries', 'history', 'backups'];
    for (const table of tables) {
      const { rows } = await pgClient.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`Table "${table}": ${rows[0].count} rows.`);
    }

    // Print a few sample registers to confirm metadata
    const { rows: sampleRegs } = await pgClient.query('SELECT id, name, entry_count FROM registers LIMIT 5');
    console.log('\nSample Registers in Neon:');
    console.table(sampleRegs);

  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await pgClient.end();
  }
}

verify();
