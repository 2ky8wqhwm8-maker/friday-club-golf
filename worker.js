export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const email =
      request.headers.get("Cf-Access-Authenticated-User-Email") || "";
    if (url.pathname === "/api/whoami") {
        return Response.json({ email });
}
    
    if (url.pathname === "/api/league") {
      try {
        const season = await env.DB.prepare(`
          SELECT id, name, minimum_rounds
          FROM seasons
          WHERE status = 'current'
          LIMIT 1
        `).first();

        if (!season) {
          return Response.json(
            { error: "No current season has been set." },
            { status: 500 }
          );
        }

        const { results } = await env.DB.prepare(`
          SELECT
            p.id,
            p.first_name,
            p.last_name,
            p.handicap,

            COUNT(r.id) AS played,

            ROUND(AVG(r.stableford_score), 2) AS average_score,

            COALESCE(SUM(r.stableford_score), 0) AS total_points

          FROM players p

          LEFT JOIN results r
            ON r.player_id = p.id
            AND r.golf_day_id IN (
              SELECT id
              FROM golf_days
              WHERE season_id = ?
            )

          WHERE p.active = 1

          GROUP BY
            p.id,
            p.first_name,
            p.last_name,
            p.handicap

          ORDER BY
            average_score DESC,
            p.last_name ASC,
            p.first_name ASC
        `).bind(season.id).all();

        for (const player of results) {

          const recent = await env.DB.prepare(`
            SELECT r.stableford_score
            FROM results r
            JOIN golf_days gd
              ON gd.id = r.golf_day_id
            WHERE r.player_id = ?
              AND gd.season_id = ?
            ORDER BY gd.play_date DESC
            LIMIT 10
          `).bind(player.id, season.id).all();

          player.last_10 = recent.results.map(
            row => row.stableford_score
          );

          player.minimum_rounds = season.minimum_rounds;

          player.eligible =
            player.played >= season.minimum_rounds;
        }

        return Response.json({
          season: season.name,
          minimum_rounds: season.minimum_rounds,
          players: results
        }, {
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

    return env.ASSETS.fetch(request);
  }
};
