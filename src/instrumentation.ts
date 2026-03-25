export async function register() {
  // Only run on the server side (Node.js runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Start the WebSocket server embedded in the Next.js process
    const { startWsServer } = await import('./lib/ws/server');
    startWsServer();
  }
}
