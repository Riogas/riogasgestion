// Health check endpoint para Docker
export async function GET() {
  return Response.json(
    { 
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    },
    { status: 200 }
  );
}
