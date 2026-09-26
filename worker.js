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

// ========================================
// MEMBERS - REGISTRATION & ADMINISTRATION
// ========================================
    
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

if (url.pathname === "/api/admin/add-member" && request.method === "POST") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const memberEmail = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const handicap = Number(body.handicap);

    if (
      !firstName ||
      !lastName ||
      !Number.isFinite(handicap)
    ) {
      return Response.json(
        { error: "First name, last name, and handicap are required." },
        { status: 400 }
      );
    }

if (memberEmail) {
  const existing = await env.DB.prepare(`
    SELECT id
    FROM players
    WHERE LOWER(email) = LOWER(?)
    LIMIT 1
  `).bind(memberEmail).first();

  if (existing) {
    return Response.json(
      { error: "A member with this email address already exists." },
      { status: 400 }
    );
  }
}

    await env.DB.prepare(`
      INSERT INTO players
        (
          first_name,
          last_name,
          email,
          phone,
          handicap,
          membership_status,
          role,
          active
        )
      VALUES (?, ?, ?, ?, ?, 'approved', 'member', 1)
    `).bind(
      firstName,
      lastName,
      memberEmail,
      phone,
      handicap
    ).run();

    return Response.json({
      success: true
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to add member",
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

if (url.pathname === "/api/admin/update-role" && request.method === "POST") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const playerId = Number(body.player_id);
    const newRole = String(body.role || "").trim();

    if (
      !Number.isInteger(playerId) ||
      !["member", "admin"].includes(newRole)
    ) {
      return Response.json(
        { error: "Invalid member or role." },
        { status: 400 }
      );
    }

    const player = await env.DB.prepare(`
      SELECT id, role
      FROM players
      WHERE id = ?
        AND membership_status = 'approved'
      LIMIT 1
    `).bind(playerId).first();

    if (!player) {
      return Response.json(
        { error: "Member not found." },
        { status: 404 }
      );
    }

    if (player.role === "admin" && newRole === "member") {

      const adminCount = await env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM players
        WHERE role = 'admin'
          AND membership_status = 'approved'
          AND active = 1
      `).first();

      if (Number(adminCount.count) <= 1) {
        return Response.json(
          { error: "You cannot remove the last administrator." },
          { status: 400 }
        );
      }
    }

    await env.DB.prepare(`
      UPDATE players
      SET role = ?
      WHERE id = ?
    `).bind(newRole, playerId).run();

    return Response.json({ success: true });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to update administrator status",
        details: error.message
      },
      { status: 500 }
    );
  }
}

// ========================================
// AVAILABILITY & GOLF DAY PLANNING
// ========================================
 if (url.pathname === "/api/availability") {

  try {

    const { results: players } = await env.DB.prepare(`
      SELECT
        id,
        first_name,
        last_name
      FROM players
      WHERE membership_status = 'approved'
        AND active = 1
      ORDER BY last_name, first_name
    `).all();

    const { results: availability } = await env.DB.prepare(`
      SELECT
        player_id,
        play_date,
        status
      FROM availability
      ORDER BY play_date
    `).all();

    const { results: plannedGolfDays } = await env.DB.prepare(`
  SELECT
    pgd.id,
    pgd.play_date,
    pgd.course_id,
    pgd.status,
    pgd.notes,
    pgd.golf_day_id,
    c.name AS course_name
  FROM planned_golf_days pgd
  LEFT JOIN courses c
    ON c.id = pgd.course_id
  ORDER BY pgd.play_date
`).all();

const settings = await env.DB.prepare(`
  SELECT start_date, update_requested_at
  FROM availability_settings
  WHERE id = 1
`).first();
    
return Response.json({
  players,
  availability,
  planned_golf_days: plannedGolfDays,
  start_date: settings?.start_date || null,
  update_requested_at: settings?.update_requested_at || null
});

  } catch (error) {

    return Response.json(
      {
        error: "Unable to load availability.",
        details: error.message
      },
      { status: 500 }
    );
  }
}   

// ========================================
// ADMIN - MOVE AVAILABILITY WINDOW
// ========================================

if (
  url.pathname === "/api/admin/move-availability-window" &&
  request.method === "POST"
) {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {

    const settings = await env.DB.prepare(`
      SELECT start_date
      FROM availability_settings
      WHERE id = 1
    `).first();

    if (!settings?.start_date) {
      return Response.json(
        { error: "Availability start date not found." },
        { status: 404 }
      );
    }

    const today = new Date()
  .toISOString()
  .slice(0, 10);

if (settings.start_date >= today) {
  return Response.json(
    {
      error:
        "The first Friday has not passed yet. The availability window cannot be moved forward."
    },
    { status: 400 }
  );
}
    
    await env.DB.prepare(`
      UPDATE availability_settings
      SET start_date = date(start_date, '+7 days'),
          update_requested_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run();

    const updated = await env.DB.prepare(`
      SELECT start_date
      FROM availability_settings
      WHERE id = 1
    `).first();

    return Response.json({
      success: true,
      start_date: updated.start_date
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to move availability window.",
        details: error.message
      },
      { status: 500 }
    );
  }
}
    
// ========================================
// ADMIN - SAVE PLANNED GOLF DAY
// ========================================
if (
  url.pathname === "/api/admin/planned-golf-day" &&
  request.method === "POST"
) {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {

    const body = await request.json();

    const playDate =
      String(body.play_date || "").trim();

    const courseId =
      Number(body.course_id);

    if (
      !playDate ||
      !Number.isInteger(courseId) ||
      courseId <= 0
    ) {
      return Response.json(
        { error: "Date and golf club are required." },
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
        { error: "Golf club not found." },
        { status: 404 }
      );
    }

    await env.DB.prepare(`
      INSERT INTO planned_golf_days
        (play_date, course_id, status, updated_at)
      VALUES (?, ?, 'planned', CURRENT_TIMESTAMP)
      ON CONFLICT(play_date)
      DO UPDATE SET
        course_id = excluded.course_id,
        status = 'planned',
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      playDate,
      courseId
    ).run();

    return Response.json({
      success: true
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to save planned golf day.",
        details: error.message
      },
      { status: 500 }
    );
  }
}

// ========================================
// ADMIN - CONFIRM BOOKED GOLF DAY
// ========================================

if (
  url.pathname === "/api/admin/book-planned-golf-day" &&
  request.method === "POST"
) {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {

    const body = await request.json();

    const playDate =
      String(body.play_date || "").trim();

    if (!playDate) {
      return Response.json(
        { error: "Golf day date is required." },
        { status: 400 }
      );
    }

    const plannedDay = await env.DB.prepare(`
      SELECT
        id,
        play_date,
        course_id,
        notes,
        status,
        golf_day_id
      FROM planned_golf_days
      WHERE play_date = ?
      LIMIT 1
    `).bind(playDate).first();

    if (!plannedDay) {
      return Response.json(
        { error: "Planned golf day not found." },
        { status: 404 }
      );
    }

    if (plannedDay.status === "booked" && plannedDay.golf_day_id) {
      return Response.json({
        success: true,
        golf_day_id: plannedDay.golf_day_id
      });
    }

    const season = await env.DB.prepare(`
      SELECT id
      FROM seasons
      WHERE status = 'current'
      LIMIT 1
    `).first();

    if (!season) {
      return Response.json(
        { error: "Current season not found." },
        { status: 400 }
      );
    }

    const result = await env.DB.prepare(`
      INSERT INTO golf_days
        (season_id, course_id, play_date, notes)
      VALUES (?, ?, ?, ?)
    `).bind(
      season.id,
      plannedDay.course_id,
      plannedDay.play_date,
      plannedDay.notes || ""
    ).run();

    const golfDayId =
      result.meta.last_row_id;

    await env.DB.prepare(`
      UPDATE planned_golf_days
      SET status = 'booked',
          golf_day_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      golfDayId,
      plannedDay.id
    ).run();

    return Response.json({
      success: true,
      golf_day_id: golfDayId
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to confirm booked golf day.",
        details: error.message
      },
      { status: 500 }
    );
  }
}    
    
// ========================================
// SAVE PLAYER AVAILABILITY
// ========================================    
 if (
  url.pathname === "/api/availability/save" &&
  request.method === "POST"
) {

  try {

    const body = await request.json();

    const playDate =
      String(body.play_date || "").trim();

    const status =
      String(body.status || "").trim();

    if (
      !playDate ||
      !["available", "unavailable"].includes(status)
    ) {
      return Response.json(
        { error: "Invalid availability." },
        { status: 400 }
      );
    }

    const player = await env.DB.prepare(`
      SELECT id
      FROM players
      WHERE LOWER(email) = LOWER(?)
        AND membership_status = 'approved'
        AND active = 1
      LIMIT 1
    `).bind(email).first();

    if (!player) {
      return Response.json(
        { error: "Approved membership required." },
        { status: 403 }
      );
    }

    await env.DB.prepare(`
      INSERT INTO availability
        (player_id, play_date, status, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(player_id, play_date)
      DO UPDATE SET
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      player.id,
      playDate,
      status
    ).run();

    return Response.json({
      success: true
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to save availability.",
        details: error.message
      },
      { status: 500 }
    );
  }
}
    
// ========================================
// GOLF DAYS - ADMINISTRATION
// ========================================
    
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
  
if (url.pathname === "/api/golf-days") {

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

if (url.pathname === "/api/golf-day-results") {

  try {
    const golfDayId =
      Number(url.searchParams.get("golf_day_id"));

    if (!Number.isInteger(golfDayId) || golfDayId <= 0) {
      return Response.json(
        { error: "Invalid golf day." },
        { status: 400 }
      );
    }

    const { results } = await env.DB.prepare(`
      SELECT
        p.first_name,
        p.last_name,
        r.handicap,
        r.stableford_score
      FROM results r
      JOIN players p
        ON p.id = r.player_id
      WHERE r.golf_day_id = ?
      ORDER BY
        r.stableford_score DESC,
        p.last_name,
        p.first_name
    `).bind(golfDayId).all();

    return Response.json({
      results: results
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to load golf day results",
        details: error.message
      },
      { status: 500 }
    );
  }
}

if (url.pathname === "/api/player-results") {

  try {
    const playerId =
      Number(url.searchParams.get("player_id"));

    if (!Number.isInteger(playerId) || playerId <= 0) {
      return Response.json(
        { error: "Invalid player." },
        { status: 400 }
      );
    }

    const player = await env.DB.prepare(`
      SELECT
        id,
        first_name,
        last_name
      FROM players
      WHERE id = ?
        AND membership_status = 'approved'
      LIMIT 1
    `).bind(playerId).first();

    if (!player) {
      return Response.json(
        { error: "Player not found." },
        { status: 404 }
      );
    }

    const { results } = await env.DB.prepare(`
      SELECT
        gd.play_date,
        c.name AS course_name,
        r.handicap,
        r.stableford_score
      FROM results r
      JOIN golf_days gd
        ON gd.id = r.golf_day_id
      JOIN courses c
        ON c.id = gd.course_id
      WHERE r.player_id = ?
      ORDER BY gd.play_date DESC
    `).bind(playerId).all();

    return Response.json({
      player: player,
      results: results
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to load player results",
        details: error.message
      },
      { status: 500 }
    );
  }
}
    
if (url.pathname === "/api/admin/delete-golf-day" && request.method === "POST") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const golfDayId = Number(body.golf_day_id);

    if (!Number.isInteger(golfDayId)) {
      return Response.json(
        { error: "Invalid golf day." },
        { status: 400 }
      );
    }

    const existing = await env.DB.prepare(`
      SELECT id
      FROM golf_days
      WHERE id = ?
      LIMIT 1
    `).bind(golfDayId).first();

    if (!existing) {
      return Response.json(
        { error: "Golf day not found." },
        { status: 404 }
      );
    }

    await env.DB.prepare(`
      DELETE FROM results
      WHERE golf_day_id = ?
    `).bind(golfDayId).run();

    await env.DB.prepare(`
      DELETE FROM golf_days
      WHERE id = ?
    `).bind(golfDayId).run();

    return Response.json({
      success: true
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to delete golf day",
        details: error.message
      },
      { status: 500 }
    );
  }
}

if (url.pathname === "/api/admin/update-golf-day" && request.method === "POST") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const golfDayId = Number(body.golf_day_id);
    const playDate = String(body.play_date || "").trim();
    const courseName = String(body.course_name || "").trim();
    const notes = String(body.notes || "").trim();

    if (!Number.isInteger(golfDayId) || !playDate || !courseName) {
      return Response.json(
        { error: "Golf day, date and golf club are required." },
        { status: 400 }
      );
    }

    const course = await env.DB.prepare(`
      SELECT id
      FROM courses
      WHERE LOWER(name) = LOWER(?)
        AND active = 1
      LIMIT 1
    `).bind(courseName).first();

    if (!course) {
      return Response.json(
        { error: "Golf club not found. Please enter an existing golf club." },
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

    await env.DB.prepare(`
      UPDATE golf_days
      SET play_date = ?,
          course_id = ?,
          notes = ?
      WHERE id = ?
    `).bind(
      playDate,
      course.id,
      notes,
      golfDayId
    ).run();

    return Response.json({ success: true });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to update golf day",
        details: error.message
      },
      { status: 500 }
    );
  }
}

// ========================================
// RESULTS - ADMINISTRATION
// ========================================
    
if (url.pathname === "/api/admin/score-players") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const golfDayId = Number(url.searchParams.get("golf_day_id"));
const { results } = await env.DB.prepare(`
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    COALESCE(r.handicap, p.handicap) AS handicap,
    r.stableford_score
  FROM players p
  LEFT JOIN results r
    ON r.player_id = p.id
    AND r.golf_day_id = ?
  WHERE p.membership_status = 'approved'
    AND p.active = 1
  ORDER BY p.last_name, p.first_name
`).bind(golfDayId).all();;

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

// ========================================
// GOLF CLUBS - ADMINISTRATION (ADD, UPDATE, DELETE
// ========================================
    
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

if (url.pathname === "/api/admin/add-course" && request.method === "POST") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const name = String(body.name || "").trim();
    const location = String(body.location || "").trim();

    if (!name) {
      return Response.json(
        { error: "Golf club name is required." },
        { status: 400 }
      );
    }

    const existing = await env.DB.prepare(`
      SELECT id
      FROM courses
      WHERE LOWER(name) = LOWER(?)
      LIMIT 1
    `).bind(name).first();

    if (existing) {
      return Response.json(
        { error: "This golf club already exists." },
        { status: 400 }
      );
    }

    await env.DB.prepare(`
      INSERT INTO courses (name, location, active)
      VALUES (?, ?, 1)
    `).bind(
      name,
      location
    ).run();

    return Response.json({
      success: true
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to add golf club",
        details: error.message
      },
      { status: 500 }
    );
  }
}    

if (url.pathname === "/api/admin/update-course" && request.method === "POST") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const courseId = Number(body.course_id);
    const name = String(body.name || "").trim();
    const location = String(body.location || "").trim();

    if (!Number.isInteger(courseId) || !name) {
      return Response.json(
        { error: "Invalid golf club details." },
        { status: 400 }
      );
    }

    const duplicate = await env.DB.prepare(`
      SELECT id
      FROM courses
      WHERE LOWER(name) = LOWER(?)
        AND id != ?
      LIMIT 1
    `).bind(name, courseId).first();

    if (duplicate) {
      return Response.json(
        { error: "Another golf club already has this name." },
        { status: 400 }
      );
    }

    await env.DB.prepare(`
      UPDATE courses
      SET name = ?,
          location = ?
      WHERE id = ?
    `).bind(
      name,
      location,
      courseId
    ).run();

    return Response.json({ success: true });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to update golf club",
        details: error.message
      },
      { status: 500 }
    );
  }
}

if (url.pathname === "/api/admin/delete-course" && request.method === "POST") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const courseId = Number(body.course_id);

    if (!Number.isInteger(courseId)) {
      return Response.json(
        { error: "Invalid golf club." },
        { status: 400 }
      );
    }

    const golfDay = await env.DB.prepare(`
      SELECT id
      FROM golf_days
      WHERE course_id = ?
      LIMIT 1
    `).bind(courseId).first();

    if (golfDay) {
      return Response.json(
        {
          error: "This golf club cannot be deleted because it has golf days recorded against it."
        },
        { status: 400 }
      );
    }

    await env.DB.prepare(`
      DELETE FROM courses
      WHERE id = ?
    `).bind(courseId).run();

    return Response.json({ success: true });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to delete golf club",
        details: error.message
      },
      { status: 500 }
    );
  }
}    

// ========================================
// MEMBER MANAGEMENT - APPROVE; REJECT, REGISTER
// ========================================
    
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

// ========================================
// LINK REGISTRATION TO EXISTING PLAYER
// ========================================
const matchingPlayers = await env.DB.prepare(`
  SELECT id
  FROM players
  WHERE LOWER(first_name) = LOWER(?)
    AND LOWER(last_name) = LOWER(?)
    AND (
  email IS NULL
  OR TRIM(email) = ''
  OR LOWER(TRIM(email)) = 'not supplied'
  OR LOWER(TRIM(email)) = 'unknown'
)
`).bind(
  firstName,
  lastName
).all();

const existingPlayer =
  matchingPlayers.results.length === 1
    ? matchingPlayers.results[0]
    : null;
    if (existingPlayer) {

  await env.DB.prepare(`
    UPDATE players
    SET email = ?,
        phone = ?,
        handicap = ?,
        membership_status = 'pending'
    WHERE id = ?
  `).bind(
    email,
    phone,
    handicap,
    existingPlayer.id
  ).run();

  return Response.json({
    registered: true,
    membership_status: "pending",
    player_id: existingPlayer.id
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

// ========================================
// NEXT GOLF DAY NOTICE
// ========================================
 if (
  url.pathname === "/api/admin/publish-golf-day-notice" &&
  request.method === "POST"
) {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {

    const body = await request.json();

    const golfDayId = Number(body.golf_day_id);
    const firstTeeTime =
      String(body.first_tee_time || "").trim();
    const message =
      String(body.message || "").trim();

    if (
      !Number.isInteger(golfDayId) ||
      golfDayId <= 0 ||
      !firstTeeTime
    ) {
      return Response.json(
        { error: "Golf day and first tee time are required." },
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

    await env.DB.prepare(`
      DELETE FROM golf_day_notice
    `).run();

    await env.DB.prepare(`
      INSERT INTO golf_day_notice
        (golf_day_id, first_tee_time, message, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      golfDayId,
      firstTeeTime,
      message
    ).run();

    return Response.json({ success: true });

  } catch (error) {

    return Response.json(
      { error: "Unable to publish golf day notice." },
      { status: 500 }
    );

  }
}   

if (url.pathname === "/api/golf-day-notice") {

  try {

    const notice = await env.DB.prepare(`
      SELECT
        n.golf_day_id,
        n.first_tee_time,
        n.message,
        n.updated_at,
        gd.play_date,
        c.name AS course_name,
        c.location AS course_location
      FROM golf_day_notice n
      JOIN golf_days gd ON gd.id = n.golf_day_id
      JOIN courses c ON c.id = gd.course_id
      LIMIT 1
    `).first();

    return Response.json({
      notice: notice || null
    });

  } catch (error) {

    return Response.json(
      { error: "Unable to load golf day notice." },
      { status: 500 }
    );

  }
}
    
// ========================================
// MEMBER-FACING LEAGUE & RESULTS
// ========================================
    
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
