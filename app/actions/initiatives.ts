"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";

export interface UpdateInitiativeInput {
  title: string;
  description: string | null;
  status: string;
  estimated_loe: string | null;
  high_level_focus: string | null;
}

export async function updateInitiative(
  id: string,
  fields: UpdateInitiativeInput
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const sql = getDb();
  await sql`
    UPDATE public.initiatives
    SET
      title            = ${fields.title},
      description      = ${fields.description},
      status           = ${fields.status},
      estimated_loe    = ${fields.estimated_loe},
      high_level_focus = ${fields.high_level_focus},
      updated_at       = now()
    WHERE id = ${id}
  `;
  revalidatePath("/");
}

export async function addOwner(initiativeId: string, email: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const sql = getDb();
  await sql`
    INSERT INTO public.initiative_owners (initiative_id, user_email)
    VALUES (${initiativeId}, ${email.toLowerCase().trim()})
    ON CONFLICT (initiative_id, user_email) DO NOTHING
  `;
  revalidatePath("/");
}

export async function removeOwner(ownerId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const sql = getDb();
  await sql`DELETE FROM public.initiative_owners WHERE id = ${ownerId}`;
  revalidatePath("/");
}
