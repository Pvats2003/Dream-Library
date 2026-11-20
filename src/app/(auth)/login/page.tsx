import type { Metadata } from "next";
import { LoginFlow } from "./login-flow";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  return <LoginFlow />;
}
