export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const email =
      request.headers.get("Cf-Access-Authenticated-User-Email") || "";
const adminPlayer = await env.DB.prepare(`
  SELECT id
  FROM players
  WHERE LOWER(email) = LOWER(?)
    AND role = 'admin'
    AND membership_status = 'approved'
  LIMIT 1
`).bind(email).first();

const isAdmin = !!adminPlayer;
    if (url.pathname === "/api/whoami") {
        return Response.json({ email });
}
    if (url.pathname === "/api/me") {
  try {
    const player = await env.DB.prepare(`
      SELECT
        id,
        first_name,
        last_name,
        email,
        handicap,
        membership_status,
        role
      FROM players
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1
    `).bind(email).first();

    if (!player) {
      return Response.json({
        email,
        registered: false
      });
    }

return Response.json({
  email,
  registered: true,
  isAdmin,
  player
});

  } catch (error) {
    return Response.json(
      {
        error: "Unable to check membership",
        details: error.message
      },
      { status: 500 }
    );
  }
}
  if (url.pathname === "/api/admin/pending") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const { results } = await env.DB.prepare(`
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone,
        handicap
      FROM players
      WHERE membership_status = 'pending'
      ORDER BY last_name, first_name
    `).all();

    return Response.json({
      pending: results
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to load pending registrations",
        details: error.message
      },
      { status: 500 }
    );
  }
} 

if (url.pathname === "/api/admin/members") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {

    const { results } = await env.DB.prepare(`
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone,
        handicap,
        membership_status,
        role,
        active
      FROM players
      WHERE membership_status = 'approved'
      ORDER BY last_name, first_name
    `).all();

    return Response.json({
      members: results
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to load members",
        details: error.message
      },
      { status: 500 }
    );
  }
}

if (url.pathname === "/api/admin/update-member" && request.method === "POST") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const playerId = Number(body.player_id);
    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const phone = String(body.phone || "").trim();
    const handicap = Number(body.handicap);
    const active = body.active ? 1 : 0;

    if (!Number.isInteger(playerId)) {
      return Response.json(
        { error: "Invalid player ID." },
        { status: 400 }
      );
    }

    if (!firstName || !lastName) {
      return Response.json(
        { error: "First name and last name are required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(handicap)) {
      return Response.json(
        { error: "A valid handicap is required." },
        { status: 400 }
      );
    }

    await env.DB.prepare(`
      UPDATE players
      SET
        first_name = ?,
        last_name = ?,
        phone = ?,
        handicap = ?,
        active = ?
      WHERE id = ?
        AND membership_status = 'approved'
    `).bind(
      firstName,
      lastName,
      phone,
      handicap,
      active,
      playerId
    ).run();

    return Response.json({
      success: true
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to update member",
        details: error.message
      },
      { status: 500 }
    );
  }
}

if (url.pathname === "/api/admin/create-golf-day" && request.method === "POST") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const courseId = Number(body.course_id);
    const playDate = String(body.play_date || "").trim();
    const notes = String(body.notes || "").trim();

    if (!Number.isInteger(courseId) || !playDate) {
      return Response.json(
        { error: "Course and date are required." },
        { status: 400 }
      );
    }

    const season = await env.DB.prepare(`
      SELECT id
      FROM seasons
      WHERE status = 'current'
      LIMIT 1
    `).first();

    if (!season) {
      return Response.json(
        { error: "No current season has been set." },
        { status: 400 }
      );
    }

    const course = await env.DB.prepare(`
      SELECT id
      FROM courses
      WHERE id = ?
        AND active = 1
      LIMIT 1
    `).bind(courseId).first();

    if (!course) {
      return Response.json(
        { error: "Selected course is not available." },
        { status: 400 }
      );
    }

    const result = await env.DB.prepare(`
      INSERT INTO golf_days
        (season_id, course_id, play_date, notes)
      VALUES (?, ?, ?, ?)
    `).bind(
      season.id,
      courseId,
      playDate,
      notes
    ).run();

    return Response.json({
      success: true,
      golf_day_id: result.meta.last_row_id
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to create golf day",
        details: error.message
      },
      { status: 500 }
    );
  }
}

if (url.pathname === "/api/admin/golf-days") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const { results } = await env.DB.prepare(`
      SELECT
        gd.id,
        gd.play_date,
        gd.notes,
        c.name AS course_name,
        c.location AS course_location
      FROM golf_days gd
      JOIN courses c
        ON c.id = gd.course_id
      JOIN seasons s
        ON s.id = gd.season_id
      WHERE s.status = 'current'
      ORDER BY gd.play_date DESC
    `).all();

    return Response.json({
      golf_days: results
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to load golf days",
        details: error.message
      },
      { status: 500 }
    );
  }
}

if (url.pathname === "/api/admin/score-players") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const { results } = await env.DB.prepare(`
      SELECT
        id,
        first_name,
        last_name,
        handicap
      FROM players
      WHERE membership_status = 'approved'
        AND active = 1
      ORDER BY last_name, first_name
    `).all();

    return Response.json({
      players: results
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to load players",
        details: error.message
      },
      { status: 500 }
    );
  }
}

if (url.pathname === "/api/admin/save-results" && request.method === "POST") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const golfDayId = Number(body.golf_day_id);
    const results = body.results;

    if (!Number.isInteger(golfDayId) || !Array.isArray(results)) {
      return Response.json(
        { error: "Invalid results data." },
        { status: 400 }
      );
    }

    const golfDay = await env.DB.prepare(`
      SELECT id
      FROM golf_days
      WHERE id = ?
      LIMIT 1
    `).bind(golfDayId).first();

    if (!golfDay) {
      return Response.json(
        { error: "Golf day not found." },
        { status: 404 }
      );
    }

    for (const result of results) {
      const playerId = Number(result.player_id);
      const handicap = Number(result.handicap);
      const score = Number(result.stableford_score);

      if (
        !Number.isInteger(playerId) ||
        !Number.isFinite(handicap) ||
        !Number.isInteger(score) ||
        score < 0
      ) {
        return Response.json(
          { error: "Invalid player result." },
          { status: 400 }
        );
      }

const existingResult = await env.DB.prepare(`
  SELECT id
  FROM results
  WHERE golf_day_id = ?
    AND player_id = ?
  LIMIT 1
`).bind(
  golfDayId,
  playerId
).first();

if (existingResult) {
  await env.DB.prepare(`
    UPDATE results
    SET stableford_score = ?,
        handicap = ?
    WHERE id = ?
  `).bind(
    score,
    handicap,
    existingResult.id
  ).run();

} else {
  await env.DB.prepare(`
    INSERT INTO results
      (golf_day_id, player_id, stableford_score, handicap)
    VALUES (?, ?, ?, ?)
  `).bind(
    golfDayId,
    playerId,
    score,
    handicap
  ).run();
}
    }

    return Response.json({
      success: true
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to save results",
        details: error.message
      },
      { status: 500 }
    );
  }
}
    
if (url.pathname === "/api/admin/courses") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {

    const { results } = await env.DB.prepare(`
      SELECT
        id,
        name,
        location
      FROM courses
      WHERE active = 1
      ORDER BY name
    `).all();

    return Response.json({
      courses: results
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to load courses",
        details: error.message
      },
      { status: 500 }
    );
  }
}
    
    if (url.pathname === "/api/admin/approve" && request.method === "POST") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const playerId = Number(body.player_id);

    if (!Number.isInteger(playerId)) {
      return Response.json(
        { error: "Invalid player ID." },
        { status: 400 }
      );
    }

    await env.DB.prepare(`
      UPDATE players
      SET membership_status = 'approved'
      WHERE id = ?
        AND membership_status = 'pending'
    `).bind(playerId).run();

    return Response.json({
      success: true
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to approve member",
        details: error.message
      },
      { status: 500 }
    );
  }
}

if (url.pathname === "/api/admin/reject" && request.method === "POST") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const playerId = Number(body.player_id);

    if (!Number.isInteger(playerId)) {
      return Response.json(
        { error: "Invalid player ID." },
        { status: 400 }
      );
    }

    await env.DB.prepare(`
      DELETE FROM players
      WHERE id = ?
        AND membership_status = 'pending'
    `).bind(playerId).run();

    return Response.json({
      success: true
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to reject member",
        details: error.message
      },
      { status: 500 }
    );
  }
}
    
    if (url.pathname === "/api/register" && request.method === "POST") {
  try {
    const body = await request.json();

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const phone = String(body.phone || "").trim();
    const handicap = Number(body.handicap);

    if (!email) {
      return Response.json(
        { error: "Your authenticated email address could not be identified." },
        { status: 401 }
      );
    }

    if (!firstName || !lastName) {
      return Response.json(
        { error: "First name and last name are required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(handicap)) {
      return Response.json(
        { error: "A valid handicap is required." },
        { status: 400 }
      );
    }

    const existing = await env.DB.prepare(`
      SELECT id, membership_status
      FROM players
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1
    `).bind(email).first();

    if (existing) {
      return Response.json({
        registered: true,
        membership_status: existing.membership_status
      });
    }

    const result = await env.DB.prepare(`
      INSERT INTO players
        (first_name, last_name, email, phone, handicap,
         membership_status, role)
      VALUES (?, ?, ?, ?, ?, 'pending', 'member')
    `).bind(
      firstName,
      lastName,
      email,
      phone,
      handicap
    ).run();

    return Response.json({
      registered: true,
      membership_status: "pending",
      player_id: result.meta.last_row_id
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to register",
        details: error.message
      },
      { status: 500 }
    );
  }
}
    
    if (url.pathname === "/api/league") {
      try {
        const member = await env.DB.prepare(`
  SELECT id
  FROM players
  WHERE LOWER(email) = LOWER(?)
    AND membership_status = 'approved'
  LIMIT 1
`).bind(email).first();

if (!member) {
  return Response.json(
    { error: "Approved membership required." },
    { status: 403 }
  );
}
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
