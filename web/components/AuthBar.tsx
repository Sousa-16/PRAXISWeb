"use client";

import { useEffect, useState } from "react";
import { Button, Group, PasswordInput, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { setJwt, praxisWeb } from "@/lib/api";
import { authEnabled, supabaseBrowser } from "@/lib/supabase";

type Props = {
  signedIn: boolean;
  onChange: () => void;
};

export function AuthBar({ signedIn, onChange }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token ?? null;
      setJwt(token);
      if (token) {
        praxisWeb.attach().then(onChange).catch(() => onChange());
      }
    });
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      setJwt(session?.access_token ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [onChange]);

  if (!authEnabled) return null;

  async function run(kind: "in" | "up") {
    const sb = supabaseBrowser();
    if (!sb) return;
    setBusy(true);
    try {
      const fn = kind === "in" ? sb.auth.signInWithPassword : sb.auth.signUp;
      const { data, error } = await fn({ email, password });
      if (error) throw error;
      setJwt(data.session?.access_token ?? null);
      if (data.session) {
        await praxisWeb.attach();
        notifications.show({ title: "Signed in", message: "This browser’s work is now tied to your account.", color: "copper" });
      } else {
        notifications.show({ title: "Check your email", message: "Confirm the account, then sign in.", color: "copper" });
      }
      onChange();
    } catch (err) {
      notifications.show({ title: "Sign-in failed", message: String(err), color: "red" });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const sb = supabaseBrowser();
    await sb?.auth.signOut();
    setJwt(null);
    onChange();
  }

  if (signedIn) {
    return (
      <Group gap="xs" wrap="wrap">
        <Text size="sm" c="dimmed" lineClamp={1} maw={180}>
          Signed in
        </Text>
        <Button size="xs" variant="subtle" onClick={signOut}>
          Sign out
        </Button>
      </Group>
    );
  }

  return (
    <Group gap="xs" wrap="wrap">
      <TextInput
        size="xs"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.currentTarget.value)}
        w={{ base: "100%", xs: 160 }}
        maw={220}
      />
      <PasswordInput
        size="xs"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.currentTarget.value)}
        w={{ base: "100%", xs: 130 }}
        maw={180}
      />
      <Button size="xs" loading={busy} onClick={() => run("in")}>
        Sign in
      </Button>
      <Button size="xs" variant="light" loading={busy} onClick={() => run("up")}>
        Create account
      </Button>
    </Group>
  );
}
