import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign up | Pokenic",
  description: "Create your Pokenic account and start collecting.",
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
