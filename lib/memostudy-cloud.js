const PROFILE_TABLE = "memostudy_profiles";
const SNAPSHOT_TABLE = "memostudy_user_snapshots";

export function buildCloudSnapshot({ projects, platformSettings, history }) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    projects: projects ?? [],
    platformSettings: platformSettings ?? {},
    history: history ?? []
  };
}

export async function ensureUserProfile(client, user, locale = "en") {
  if (!client || !user?.id) {
    return null;
  }

  const payload = {
    id: user.id,
    email: user.email ?? "",
    full_name: user.user_metadata?.full_name ?? "",
    preferred_locale: locale,
    updated_at: new Date().toISOString()
  };

  const { error } = await client.from(PROFILE_TABLE).upsert(payload, { onConflict: "id" });
  if (error) {
    throw error;
  }

  return payload;
}

export async function loadUserSnapshot(client, userId) {
  if (!client || !userId) {
    return null;
  }

  const { data, error } = await client
    .from(SNAPSHOT_TABLE)
    .select("payload, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.payload ?? null;
}

export async function saveUserSnapshot(client, userId, snapshot) {
  if (!client || !userId) {
    return null;
  }

  const { error } = await client.from(SNAPSHOT_TABLE).upsert(
    {
      user_id: userId,
      payload: snapshot,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }

  return snapshot;
}
