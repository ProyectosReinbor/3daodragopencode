import { createGuardianState, reconcileGuardian, guardianDTO, applyGuardianAction, normalizeGuardianRequest, guardianRequestFingerprint, GuardianError, initializeEmptyGuardianProfile, resolveIncubationMs } from './guardian-domain.js';

/** All guardian writes and profile rewards share one synchronous SQLite transaction. */
export function mountFoodieGuardian(app, { db, auth, getProfile, saveProfile, now = Date.now, random = {}, incubationMs }) {
  const incubationDuration = resolveIncubationMs(incubationMs);
  db.exec(`CREATE TABLE IF NOT EXISTS foodie_guardians (
    phone TEXT PRIMARY KEY REFERENCES users(phone) ON DELETE CASCADE,
    data TEXT NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS foodie_guardian_requests (
    phone TEXT NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
    request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, message TEXT NOT NULL, created_at INTEGER NOT NULL,
    PRIMARY KEY (phone, request_id)
  )`);
  const readState = db.prepare('SELECT data FROM foodie_guardians WHERE phone = ?');
  const writeState = db.prepare('INSERT INTO foodie_guardians (phone, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(phone) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at');
  const readRequest = db.prepare('SELECT fingerprint, message FROM foodie_guardian_requests WHERE phone = ? AND request_id = ?');
  const writeRequest = db.prepare('INSERT INTO foodie_guardian_requests (phone, request_id, fingerprint, message, created_at) VALUES (?, ?, ?, ?, ?)');
  function load(phone, timestamp) {
    let profile = getProfile(phone);
    if (!profile?.characters?.characters?.length && typeof profile?.nft?.id !== 'string') {
      // Defaults are returned without a profile write; first hatch persists them.
      profile = initializeEmptyGuardianProfile(profile || {});
    }
    if (!profile?.characters?.characters?.length && typeof profile?.nft?.id === 'string') {
      // Preserve legacy appearances and the original NFT while exposing the same
      // owned pet through the collection used by the guardian and growth APIs.
      const pet = { ...structuredClone(profile.nft), source: 'generated', isStarter: true, unlockedAt: timestamp };
      profile.characters = { characters: [pet], selectedId: pet.id };
      profile.selectedCharacter = pet.id;
      saveProfile(phone, profile);
    }
    const row = readState.get(phone);
    const state = row ? JSON.parse(row.data) : createGuardianState(profile, timestamp, random);
    reconcileGuardian(state, profile, timestamp, random);
    return { profile, state };
  }
  function save(phone, state, timestamp) { writeState.run(phone, JSON.stringify(state), timestamp); }
  const handle = (operation) => (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json(operation(req));
    } catch (error) {
      if (error instanceof GuardianError) return res.status(error.status).json({ error: error.message });
      console.error('[AODASE Pets guardian]', error);
      res.status(500).json({ error: 'No se pudo guardar tu hogar. Inténtalo de nuevo.' });
    }
  };
  const read = db.transaction((phone) => {
    const timestamp = now();
    const { profile, state } = load(phone, timestamp);
    save(phone, state, timestamp);
    return { profile, guardian: guardianDTO(state, profile, timestamp) };
  });
  const mutate = db.transaction((phone, body) => {
    const request = normalizeGuardianRequest(body);
    const signature = guardianRequestFingerprint(request);
    const timestamp = now();
    const { profile, state } = load(phone, timestamp);
    const previous = readRequest.get(phone, request.requestId);
    if (previous) {
      if (previous.fingerprint !== signature) throw new GuardianError('Ese identificador ya se usó para otra acción.', 409);
      save(phone, state, timestamp);
      return { profile, guardian: guardianDTO(state, profile, timestamp), message: previous.message };
    }
    const result = applyGuardianAction(state, profile, request, timestamp, random, incubationDuration);
    if (result.profileChanged) saveProfile(phone, profile);
    save(phone, state, timestamp);
    writeRequest.run(phone, request.requestId, signature, result.message, timestamp);
    return { profile, guardian: guardianDTO(state, profile, timestamp), message: result.message };
  });
  app.get('/api/guardian', auth, handle(req => read(req.phone)));
  app.post('/api/guardian/action', auth, handle(req => mutate(req.phone, req.body)));
}
