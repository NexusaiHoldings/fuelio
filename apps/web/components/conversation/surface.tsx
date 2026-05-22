/**
 * ConversationSurface — primary user-facing surface of every portfolio company.
 *
 * Spec §6.1: "The window the agent is already running, the user nudges through it."
 * This is a substrate-provided default; companies may extend it with domain-specific
 * conversation hooks but should NOT replace it wholesale (forks require chairman approval).
 */

import type { JSX } from "react";

export interface ConversationSurfaceProps {
  readonly companyName: string;
}

export function ConversationSurface({
  companyName,
}: ConversationSurfaceProps): JSX.Element {
  return (
    <section
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "4rem 1.5rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
        {companyName}
      </h1>
      <p style={{ marginBottom: "1.5rem", opacity: 0.7 }}>
        Your operator is online. Tell it what you need.
      </p>
      <div
        role="region"
        aria-label="Conversation"
        style={{
          border: "1px solid rgba(0,0,0,0.1)",
          borderRadius: 8,
          padding: "1.5rem",
          minHeight: 240,
        }}
      >
        <p style={{ opacity: 0.5, fontStyle: "italic" }}>
          Conversation history loads here. (Substrate placeholder — wires to
          portfolio-runtime in Phase 2.)
        </p>
      </div>
    </section>
  );
}
