export default async () => {
  return new Response(
    JSON.stringify({
      status: "ok",
      anthropic_configured: !!process.env.ANTHROPIC_API_KEY,
      census_configured: !!process.env.CENSUS_API_KEY,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
};

export const config = {
  path: "/api/health",
};
