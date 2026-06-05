import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Log in | Pokenic",
  description: "Log in to your Pokenic account.",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
