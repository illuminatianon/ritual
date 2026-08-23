import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../client';
import { oauthAccounts, users } from '../schema';

export type AppUser = typeof users.$inferSelect;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return user ?? null;
}

export async function findUserByOAuthAccount(provider: string, providerAccountId: string) {
  const [row] = await db
    .select({ user: users })
    .from(oauthAccounts)
    .innerJoin(users, eq(oauthAccounts.userId, users.id))
    .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, providerAccountId)))
    .limit(1);
  return row?.user ?? null;
}

export async function createUserWithOAuthAccount(args: {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  provider: string;
  providerAccountId: string;
}) {
  return db.transaction(async (tx) => {
    const email = normalizeEmail(args.email);
    const [existing] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
    let user = existing;
    if (!user) {
      const [created] = await tx.insert(users).values({
        id: randomUUID(),
        email,
        displayName: args.displayName,
        avatarUrl: args.avatarUrl,
        lastLoginAt: new Date(),
      }).returning();
      if (!created) {
        throw new Error('Failed to create user.');
      }
      user = created;
    }

    const [account] = await tx
      .select()
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, args.provider), eq(oauthAccounts.providerAccountId, args.providerAccountId)))
      .limit(1);

    if (account && account.userId !== user.id) {
      throw new Error('OAuth account is already linked to another user.');
    }

    if (!account) {
      await tx.insert(oauthAccounts).values({
        id: randomUUID(),
        userId: user.id,
        provider: args.provider,
        providerAccountId: args.providerAccountId,
      });
    }

    const [updated] = await tx.update(users).set({
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(users.id, user.id)).returning();
    return updated;
  });
}

export async function recordUserLogin(userId: string, displayName: string | null, avatarUrl: string | null) {
  const [user] = await db.update(users).set({
    displayName,
    avatarUrl,
    lastLoginAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(users.id, userId)).returning();
  return user ?? null;
}
