import "./globals.css";

export const metadata = {
  title: "PRAGATI 2027 — The wait is over",
  description: "The countdown to the next chapter of PRAGATI has begun.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
