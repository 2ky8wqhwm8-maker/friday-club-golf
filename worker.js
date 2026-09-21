export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Return the current league table
    if (url.pathname === "/api/league") {
      try {
        const { results } = await env.DB.prepare(`
          SELECT
            p.id,
            p.first_name,
            p.last_name,
            p.handicap,
            COUNT(r.id) AS played,
            ROUND(AVG(r.stableford_score), 2) AS average_score,
            SUM(r.stableford_score) AS total_points,
            s.minimum_rounds
          FROM players p
          LEFT JOIN results r
            ON r.player_id = p.id
          LEFT JOIN golf_days gd
            ON gd.id = r.golf_day_id
          LEFT JOIN seasons s
            ON s.id = gd.season_id
            AND s.status = 'current'
          WHERE p.active = 1
          GROUP BY
            p.id,
            p.first_name,
            p.last_name,
            p.handicap,
            s.minimum_rounds
          ORDER BY average_score DESC
        `).all();

        return Response.json(results, {
          headers: {
            "Cache-Control": "no-store"
          }
        });

      } catch (error) {
        return Response.json(
          {
            error: "Unable to load league table",
            details: error.message
          },
          { status: 500 }
        );
      }
    }

    return new Response("Friday Club Golf Society", {
      headers: { "Content-Type": "text/plain;charset=UTF-8" }
    });
  }
};
