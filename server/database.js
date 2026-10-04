// Keep the existing driver in production; Node's SQLite supports local setups
// where the native addon has no binary for the installed Node version.
export async function createDatabase(filename) {
  try {
    const { default: Database } = await import('better-sqlite3');
    return new Database(filename);
  } catch (error) {
    const unavailable = error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND'
      || error.message.includes('Could not locate the bindings file');
    if (!unavailable) throw error;
    const { DatabaseSync } = await import('node:sqlite');
    const database = new DatabaseSync(filename);
    return {
      prepare: (sql) => database.prepare(sql),
      exec: (sql) => database.exec(sql),
      pragma: (pragma) => database.exec(`PRAGMA ${pragma}`),
      close: () => database.close(),
      transaction: (action) => (...args) => {
        database.exec('BEGIN IMMEDIATE');
        try {
          const result = action(...args);
          database.exec('COMMIT');
          return result;
        } catch (error) {
          database.exec('ROLLBACK');
          throw error;
        }
      },
    };
  }
}
