import { and, asc, eq, ne } from "drizzle-orm";
import { db, type Group, listMembers, type Member } from "./db";
import { groupBans, groups, members } from "./schema";

// Running a group: one admin, who can rename it, hand the role over,
// remove someone, and archive it. Anyone can leave.

/** The admin's member id: the one recorded, or --- if they've gone, or the
 *  group predates admins --- the longest-standing member. */
export function adminIdOf(group: Group): number | undefined {
  const all = listMembers(group.id);
  return all.find((m) => m.id === group.adminId)?.id ?? all[0]?.id;
}

export const isAdmin = (group: Group, member: Member) => adminIdOf(group) === member.id;
export const isArchived = (group: Group) => group.archivedAt !== null;

export function renameGroup(groupId: string, name: string): void {
  db.update(groups).set({ name }).where(eq(groups.id, groupId)).run();
}

export function setAdmin(groupId: string, memberId: number): void {
  db.update(groups).set({ adminId: memberId }).where(eq(groups.id, groupId)).run();
}

export function setArchived(groupId: string, archived: boolean): void {
  db.update(groups)
    .set({ archivedAt: archived ? new Date().toISOString() : null })
    .where(eq(groups.id, groupId))
    .run();
}

export function memberById(groupId: string, memberId: number): Member | undefined {
  return db
    .select()
    .from(members)
    .where(and(eq(members.groupId, groupId), eq(members.id, memberId)))
    .get();
}

/** The admin removes someone. A removed person (by profile) can't rejoin by
 *  the link; their hours and answers go with them. */
export function removeMember(groupId: string, member: Member): void {
  db.transaction((tx) => {
    if (member.personId !== null) {
      tx.insert(groupBans).values({ groupId, personId: member.personId }).onConflictDoNothing().run();
    }
    tx.delete(members).where(eq(members.id, member.id)).run();
  });
}

export function isBanned(groupId: string, personId: number): boolean {
  return !!db
    .select()
    .from(groupBans)
    .where(and(eq(groupBans.groupId, groupId), eq(groupBans.personId, personId)))
    .get();
}

/** Leave a group. An admin hands over to the longest-standing member; the
 *  last one out takes the group with them. */
export function leaveGroup(group: Group, member: Member): "left" | "gone" {
  return db.transaction((tx) => {
    const next = tx
      .select()
      .from(members)
      .where(and(eq(members.groupId, group.id), ne(members.id, member.id)))
      .orderBy(asc(members.id))
      .get();
    if (!next) {
      tx.delete(groups).where(eq(groups.id, group.id)).run();
      return "gone";
    }
    if (adminIdOf(group) === member.id) {
      tx.update(groups).set({ adminId: next.id }).where(eq(groups.id, group.id)).run();
    }
    tx.delete(members).where(eq(members.id, member.id)).run();
    return "left";
  });
}
