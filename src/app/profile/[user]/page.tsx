import type { Metadata } from "next";
import { MOCK_USERS, userOrGeneric } from "@/lib/mock/users";
import ProfileClient from "./ProfileClient";

export function generateStaticParams() {
  return MOCK_USERS.map((u) => ({ user: u.username }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ user: string }>;
}): Promise<Metadata> {
  const { user } = await params;
  const u = userOrGeneric(decodeURIComponent(user));
  return { title: `${u.username} | Pokenic`, description: `${u.username}'s collection on Pokenic.` };
}

export default async function ProfilePage({ params }: { params: Promise<{ user: string }> }) {
  const { user } = await params;
  const u = userOrGeneric(decodeURIComponent(user));
  return <ProfileClient user={u} />;
}
