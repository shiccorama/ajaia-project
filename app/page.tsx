/**
 * Placeholder page — **ChatGPT owns this file** (per docs/AGENT_CONTRACT.md §8).
 *
 * The DeepSeek lane is backend-only. It deliberately does not ship an editor UI,
 * because that surface belongs to Kimi. This page exists so the app builds and so the
 * API can be smoke-tested from a running server.
 *
 * API surface implemented by this lane:
 *   GET    /api/health
 *   GET    /api/me
 *   POST   /api/auth/demo-login
 *   POST   /api/auth/logout
 *   GET    /api/documents
 *   POST   /api/documents
 *   GET    /api/documents/:id
 *   PATCH  /api/documents/:id
 *   DELETE /api/documents/:id
 *   GET    /api/documents/:id/members
 *   POST   /api/documents/:id/members
 *   PATCH  /api/documents/:id/members/:userId
 *   DELETE /api/documents/:id/members/:userId
 *   POST   /api/documents/import
 *
 * See docs/AGENT_CONTRACT.md for the full request/response contract.
 */
export default function Page() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 24px',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Ajaia Collaborative Editor</h1>
      <p style={{ color: '#536273' }}>
        The backend is running. The editor interface is owned by the UI lane and is not
        part of this build.
      </p>
      <p>
        Try <code>GET /api/health</code> or open <code>docs/AGENT_CONTRACT.md</code> for the
        full API contract.
      </p>
    </main>
  );
}
