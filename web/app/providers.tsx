"use client";

import {
  Badge,
  Button,
  Card,
  createTheme,
  MantineProvider,
  Paper,
  Select,
  Textarea,
  TextInput,
  type MantineColorsTuple,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";

const copper: MantineColorsTuple = [
  "#fff0e9",
  "#fddfd3",
  "#f6bda3",
  "#ef9870",
  "#e97a47",
  "#e5672d",
  "#d85a2a",
  "#c04c21",
  "#a8401b",
  "#8b3415",
];

const sea: MantineColorsTuple = [
  "#e8f6f7",
  "#d0ebee",
  "#a4d6db",
  "#74bfc7",
  "#4eabb5",
  "#359ea9",
  "#1f6f78",
  "#1a6068",
  "#145258",
  "#0c3e43",
];

const theme = createTheme({
  primaryColor: "copper",
  primaryShade: { light: 6, dark: 4 },
  colors: { copper, sea },
  fontFamily: "var(--font-body)",
  fontFamilyMonospace: "var(--font-mono)",
  headings: {
    fontFamily: "var(--font-brand)",
    fontWeight: "700",
  },
  defaultRadius: "md",
  components: {
    Button: Button.extend({
      defaultProps: { radius: "md" },
      styles: {
        root: { fontWeight: 650, letterSpacing: "-0.01em" },
      },
    }),
    Card: Card.extend({
      defaultProps: { radius: "md", padding: "lg" },
      styles: {
        root: {
          background: "var(--panel)",
          borderColor: "var(--line)",
          backdropFilter: "blur(8px)",
        },
      },
    }),
    Paper: Paper.extend({
      defaultProps: { radius: "md" },
      styles: {
        root: {
          background: "var(--panel-solid)",
          borderColor: "var(--line)",
        },
      },
    }),
    Badge: Badge.extend({
      defaultProps: { radius: "sm" },
    }),
    TextInput: TextInput.extend({
      styles: {
        input: { background: "var(--panel-solid)" },
      },
    }),
    Select: Select.extend({
      styles: {
        input: { background: "var(--panel-solid)" },
      },
    }),
    Textarea: Textarea.extend({
      styles: {
        input: { background: "var(--panel-solid)" },
      },
    }),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider defaultColorScheme="light" theme={theme}>
      <Notifications position="top-right" />
      {children}
    </MantineProvider>
  );
}
