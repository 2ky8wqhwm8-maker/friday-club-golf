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
  AND active = 1
LIMIT 1
`).bind(email).first();

const isAdmin = !!adminPlayer;
    if (email) {
  await env.DB.prepare(`
    UPDATE players
    SET last_logged_on = CURRENT_TIMESTAMP
    WHERE LOWER(email) = LOWER(?)
      AND membership_status = 'approved'
      AND (
        last_logged_on IS NULL
        OR DATE(last_logged_on) < DATE('now')
      )
  `).bind(email).run();
}
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
    let { results } = await env.DB.prepare(`
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
        whs_membership_no,
        handicap,
        membership_status,
role,
active,
last_logged_on
      FROM players
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
const whsMembershipNo =
  String(body.whs_membership_no || "").trim();
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
          whs_membership_no,
          handicap,
          membership_status,
          role,
          active
        )
      VALUES (?, ?, ?, ?, ?, ?, 'approved', 'member', 1)
    `).bind(
      firstName,
      lastName,
      memberEmail,
      phone,
      whsMembershipNo,
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
    const email = String(body.email || "").trim();
    const whsMembershipNo =
        String(body.whs_membership_no || "").trim();
    const phone = String(body.phone || "").trim();
    const handicap = Number(body.handicap);
    const active = body.active ? 1 : 0;
const membershipStatus =
  String(body.membership_status || "").trim();

const role =
  String(body.role || "").trim();
    
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

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  return Response.json(
    { error: "A valid email address is required." },
    { status: 400 }
  );
}

    const duplicateEmail = await env.DB.prepare(`
  SELECT id
  FROM players
  WHERE LOWER(email) = LOWER(?)
    AND id != ?
  LIMIT 1
`).bind(email, playerId).first();

if (duplicateEmail) {
  return Response.json(
    { error: "This email address is already used by another member." },
    { status: 400 }
  );
}

    if (!Number.isFinite(handicap)) {
      return Response.json(
        { error: "A valid handicap is required." },
        { status: 400 }
      );
    }

if (!["approved", "pending"].includes(membershipStatus)) {
  return Response.json(
    { error: "Invalid membership status." },
    { status: 400 }
  );
}

if (!["admin", "member"].includes(role)) {
  return Response.json(
    { error: "Invalid member role." },
    { status: 400 }
  );
}

const currentMember = await env.DB.prepare(`
  SELECT role, active, membership_status
  FROM players
  WHERE id = ?
`).bind(playerId).first();

if (!currentMember) {
  return Response.json(
    { error: "Member not found." },
    { status: 404 }
  );
}

if (
  currentMember.role === "admin" &&
  currentMember.active === 1 &&
  currentMember.membership_status === "approved" &&
  (
    role !== "admin" ||
    active !== 1 ||
    membershipStatus !== "approved"
  )
) {
  const otherAdmin = await env.DB.prepare(`
    SELECT id
    FROM players
    WHERE role = 'admin'
      AND active = 1
      AND membership_status = 'approved'
      AND id != ?
    LIMIT 1
  `).bind(playerId).first();

  if (!otherAdmin) {
    return Response.json(
      {
        error: "You cannot remove or deactivate the last administrator."
      },
      { status: 400 }
    );
  }
}
    
   await env.DB.prepare(`
  UPDATE players
  SET
    first_name = ?,
    last_name = ?,
    email = ?,
    phone = ?,
    whs_membership_no = ?,
    handicap = ?,
    active = ?,
    membership_status = ?,
    role = ?
  WHERE id = ?
`).bind(
  firstName,
  lastName,
  email,
  phone,
  whsMembershipNo,
  handicap,
  active,
  membershipStatus,
  role,
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
      SELECT id, role, active
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

    if (
  player.role === "admin" &&
  player.active === 1 &&
  newRole === "member"
) {

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

    const requestedPlayerId =
  Number(body.player_id || 0);

    if (
  !playDate ||
  !["available", "unavailable", "unsure"].includes(status)
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

    let targetPlayerId = player.id;

if (requestedPlayerId && requestedPlayerId !== player.id) {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  const targetPlayer = await env.DB.prepare(`
    SELECT id
    FROM players
    WHERE id = ?
      AND membership_status = 'approved'
      AND active = 1
    LIMIT 1
  `).bind(requestedPlayerId).first();

  if (!targetPlayer) {
    return Response.json(
      { error: "Selected member not found or inactive." },
      { status: 404 }
    );
  }

  targetPlayerId = targetPlayer.id;
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
  targetPlayerId,
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
  gd.results_submitted,
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
  p.id AS player_id,
  p.first_name,
  p.last_name,
  r.handicap,
  r.stableford_score
  ,
(
  SELECT r2.stableford_score
  FROM results r2
  JOIN golf_days gd2
    ON gd2.id = r2.golf_day_id
  JOIN golf_days current_day
    ON current_day.id = r.golf_day_id
  WHERE r2.player_id = r.player_id
    AND gd2.season_id = current_day.season_id
    AND gd2.results_submitted = 1
    AND r2.stableford_score IS NOT NULL
    AND (
      gd2.play_date < current_day.play_date
      OR (
        gd2.play_date = current_day.play_date
        AND gd2.id < current_day.id
      )
    )
  ORDER BY gd2.play_date DESC, gd2.id DESC
  LIMIT 1
) AS previous_score,
(
  SELECT MAX(r3.stableford_score)
  FROM results r3
  JOIN golf_days gd3
    ON gd3.id = r3.golf_day_id
  JOIN golf_days current_day3
    ON current_day3.id = r.golf_day_id
  WHERE r3.player_id = r.player_id
    AND gd3.season_id = current_day3.season_id
    AND gd3.results_submitted = 1
    AND r3.stableford_score IS NOT NULL
    AND (
      gd3.play_date < current_day3.play_date
      OR (
        gd3.play_date = current_day3.play_date
        AND gd3.id < current_day3.id
      )
    )
) AS previous_best_score
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

// Season Highlights
if (url.pathname === "/api/season-highlights") {
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

    const requestedSeason = url.searchParams.get("season");

    const season = await env.DB.prepare(`
      SELECT id, name
      FROM seasons
      WHERE
        (? IS NULL AND status = 'current')
        OR
        (? IS NOT NULL AND id = ?)
      LIMIT 1
    `).bind(
      requestedSeason,
      requestedSeason,
      requestedSeason
    ).first();

    if (!season) {
      return Response.json(
        { error: "Season not found." },
        { status: 404 }
      );
    }

    const golfDays = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM golf_days
      WHERE season_id = ?
        AND results_submitted = 1
        AND play_date <= date('now')
    `).bind(season.id).first();

    const scores = await env.DB.prepare(`
      SELECT
        COUNT(r.id) AS rounds_played,
        ROUND(AVG(r.stableford_score), 1) AS average_score
      FROM results r
      JOIN golf_days gd
        ON gd.id = r.golf_day_id
      WHERE gd.season_id = ?
        AND gd.results_submitted = 1
        AND gd.play_date <= date('now')
        AND r.stableford_score IS NOT NULL
    `).bind(season.id).first();

    const highestScore = await env.DB.prepare(`
  SELECT
    p.first_name,
    p.last_name,
    r.stableford_score,
    gd.play_date,
    c.name AS course_name
  FROM results r
  JOIN players p
    ON p.id = r.player_id
  JOIN golf_days gd
    ON gd.id = r.golf_day_id
  JOIN courses c
    ON c.id = gd.course_id
  WHERE gd.season_id = ?
    AND gd.results_submitted = 1
    AND gd.play_date <= date('now')
    AND r.stableford_score IS NOT NULL
  ORDER BY
    r.stableford_score DESC,
    gd.play_date ASC
  LIMIT 1
`).bind(season.id).first();

    // Most Consistent Golfer
const mostConsistent = await env.DB.prepare(`
  SELECT
    p.first_name,
    p.last_name,
    COUNT(r.id) AS rounds_played,
    ROUND(AVG(r.stableford_score), 1) AS average_score,
    ROUND(
      SQRT(
        AVG(r.stableford_score * r.stableford_score)
        - AVG(r.stableford_score) * AVG(r.stableford_score)
      ), 2
    ) AS consistency
  FROM results r
  JOIN players p
    ON p.id = r.player_id
  JOIN golf_days gd
    ON gd.id = r.golf_day_id
  WHERE gd.season_id = ?
    AND gd.results_submitted = 1
    AND gd.play_date <= date('now')
    AND r.stableford_score IS NOT NULL
  GROUP BY p.id, p.first_name, p.last_name
  HAVING COUNT(r.id) >= 10
  ORDER BY consistency ASC, average_score DESC
  LIMIT 1
`).bind(season.id).first();

    // Most Improved Golfer
const improvementResults = await env.DB.prepare(`
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    r.stableford_score,
    gd.play_date
  FROM results r
  JOIN players p ON p.id = r.player_id
  JOIN golf_days gd ON gd.id = r.golf_day_id
  WHERE gd.season_id = ?
    AND gd.results_submitted = 1
    AND gd.play_date <= date('now')
    AND r.stableford_score IS NOT NULL
  ORDER BY p.id, gd.play_date ASC, gd.id ASC
`).bind(season.id).all();

const playerRounds = new Map();

for (const round of improvementResults.results) {
  if (!playerRounds.has(round.id)) {
    playerRounds.set(round.id, {
      first_name: round.first_name,
      last_name: round.last_name,
      scores: []
    });
  }

  playerRounds.get(round.id).scores.push(
    Number(round.stableford_score)
  );
}

let mostImproved = null;

for (const player of playerRounds.values()) {
  if (player.scores.length < 10) continue;

  const firstFive = player.scores.slice(0, 5);
  const lastFive = player.scores.slice(-5);

  const earlierAverage =
    firstFive.reduce((a, b) => a + b, 0) / 5;

  const recentAverage =
    lastFive.reduce((a, b) => a + b, 0) / 5;

  const improvement = recentAverage - earlierAverage;

  if (!mostImproved || improvement > mostImproved.improvement) {
    mostImproved = {
      first_name: player.first_name,
      last_name: player.last_name,
      rounds_played: player.scores.length,
      earlierAverage: Number(earlierAverage.toFixed(1)),
      recentAverage: Number(recentAverage.toFixed(1)),
      improvement: Number(improvement.toFixed(1))
    };
  }
}

if (mostImproved && mostImproved.improvement <= 0) {
  mostImproved = null;
}

// Most Rounds Played
const mostRoundsPlayed = await env.DB.prepare(`
  SELECT
    p.first_name,
    p.last_name,
    COUNT(r.id) AS rounds_played
  FROM results r
  JOIN players p
    ON p.id = r.player_id
  JOIN golf_days gd
    ON gd.id = r.golf_day_id
  WHERE gd.season_id = ?
    AND gd.results_submitted = 1
    AND gd.play_date <= date('now')
    AND r.stableford_score IS NOT NULL
  GROUP BY p.id, p.first_name, p.last_name
    ORDER BY rounds_played DESC, p.last_name ASC
`).bind(season.id).all();

    const roundsLeaders = mostRoundsPlayed.results.filter(
  player =>
    Number(player.rounds_played) ===
    Number(mostRoundsPlayed.results[0]?.rounds_played)
);

// Best Average Stableford Score
const bestAverageResults = await env.DB.prepare(`
  SELECT
    p.first_name,
    p.last_name,
    COUNT(r.id) AS rounds_played,
    ROUND(AVG(r.stableford_score), 2) AS average_score
  FROM results r
  JOIN players p ON p.id = r.player_id
  JOIN golf_days gd ON gd.id = r.golf_day_id
  WHERE gd.season_id = ?
    AND gd.results_submitted = 1
    AND gd.play_date <= date('now')
    AND r.stableford_score IS NOT NULL
  GROUP BY p.id, p.first_name, p.last_name
  HAVING COUNT(r.id) >= 10
  ORDER BY average_score DESC, p.last_name ASC
`).bind(season.id).all();

const bestAverageLeaders = bestAverageResults.results.filter(
  player =>
    Number(player.average_score) ===
    Number(bestAverageResults.results[0]?.average_score)
);

// Most Scores of 36 Points or More
const scores36Results = await env.DB.prepare(`
  SELECT
    p.first_name,
    p.last_name,
    COUNT(r.id) AS scores_36_plus
  FROM results r
  JOIN players p ON p.id = r.player_id
  JOIN golf_days gd ON gd.id = r.golf_day_id
  WHERE gd.season_id = ?
    AND gd.results_submitted = 1
    AND gd.play_date <= date('now')
    AND r.stableford_score >= 36
  GROUP BY p.id, p.first_name, p.last_name
  ORDER BY scores_36_plus DESC, p.last_name ASC
`).bind(season.id).all();

const scores36Leaders = scores36Results.results.filter(
  player =>
    Number(player.scores_36_plus) ===
    Number(scores36Results.results[0]?.scores_36_plus)
);

// Most Scores of 40 Points or More
const scores40Results = await env.DB.prepare(`
  SELECT
    p.first_name,
    p.last_name,
    COUNT(r.id) AS scores_40_plus
  FROM results r
  JOIN players p ON p.id = r.player_id
  JOIN golf_days gd ON gd.id = r.golf_day_id
  WHERE gd.season_id = ?
    AND gd.results_submitted = 1
    AND gd.play_date <= date('now')
    AND r.stableford_score >= 40
  GROUP BY p.id, p.first_name, p.last_name
  ORDER BY scores_40_plus DESC, p.last_name ASC
`).bind(season.id).all();

const scores40Leaders = scores40Results.results.filter(
  player =>
    Number(player.scores_40_plus) ===
    Number(scores40Results.results[0]?.scores_40_plus)
);

// Best Round at Each Course
const bestRoundsByCourse = await env.DB.prepare(`
  SELECT
    c.name AS course_name,
    p.first_name,
    p.last_name,
    r.stableford_score,
    gd.play_date
  FROM results r
  JOIN players p ON p.id = r.player_id
  JOIN golf_days gd ON gd.id = r.golf_day_id
  JOIN courses c ON c.id = gd.course_id
  WHERE gd.season_id = ?
    AND gd.results_submitted = 1
    AND gd.play_date <= date('now')
    AND r.stableford_score IS NOT NULL
    AND r.stableford_score = (
      SELECT MAX(r2.stableford_score)
      FROM results r2
      JOIN golf_days gd2 ON gd2.id = r2.golf_day_id
      WHERE gd2.course_id = gd.course_id
        AND gd2.season_id = gd.season_id
        AND gd2.results_submitted = 1
        AND gd2.play_date <= date('now')
    )
  ORDER BY c.name, p.last_name, gd.play_date
`).bind(season.id).all();
    
    return Response.json({
  season: season.name,
  golfDaysPlayed: golfDays.total,
  roundsPlayed: scores.rounds_played,
  averageScore: scores.average_score,
  highestScore: highestScore,
  mostConsistent: mostConsistent,
  mostImproved: mostImproved,
mostRoundsPlayed: roundsLeaders,
bestAverage: bestAverageLeaders,
scores36Leaders: scores36Leaders,
scores40Leaders: scores40Leaders,
bestRoundsByCourse: bestRoundsByCourse.results
});;

  } catch (error) {
    return Response.json(
      { error: "Unable to load season highlights." },
      { status: 500 }
    );
  }
}
// End Season Highlights
    
if (url.pathname === "/api/player-results") {

  try {
    const playerId =
      Number(url.searchParams.get("player_id"));

    const requestedSeason = url.searchParams.get("season") || null;

    if (!Number.isInteger(playerId) || playerId <= 0) {
      return Response.json(
        { error: "Invalid player." },
        { status: 400 }
      );
    }

const season = await env.DB.prepare(`
  SELECT id, name
  FROM seasons
  WHERE
    (? IS NULL AND status = 'current')
    OR
    (? IS NOT NULL AND id = ?)
  LIMIT 1
`).bind(
  requestedSeason,
  requestedSeason,
  requestedSeason
).first();

if (!season) {
  return Response.json(
    { error: "Season not found." },
    { status: 404 }
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
  gd.id AS golf_day_id,
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
  AND gd.season_id = ?
ORDER BY gd.play_date DESC
`).bind(playerId, season.id).all();

const golfDaysHeld = await env.DB.prepare(`
  SELECT COUNT(*) AS total
  FROM golf_days
  WHERE season_id = ?
    AND play_date <= date('now')
    AND results_submitted = 1
`).bind(season.id).first();
    
    return Response.json({
  player: player,
  season: season.name,
  results: results,
  golfDaysHeld: golfDaysHeld.total
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

// ========================================
// PLAYER COURSE AVERAGES — ALL SEASONS
// ========================================

if (url.pathname === "/api/player-course-averages") {
  try {
    const playerId = Number(url.searchParams.get("player_id"));

    if (!Number.isInteger(playerId) || playerId <= 0) {
      return Response.json(
        { error: "Invalid player." },
        { status: 400 }
      );
    }

    const { results } = await env.DB.prepare(`
      SELECT
        s.name AS season_name,
        c.name AS course_name,
        COUNT(r.id) AS rounds_played,
        ROUND(AVG(r.stableford_score), 2) AS average_score
      FROM results r
      JOIN golf_days gd ON gd.id = r.golf_day_id
      JOIN courses c ON c.id = gd.course_id
      JOIN seasons s ON s.id = gd.season_id
      JOIN players p ON p.id = r.player_id
      WHERE r.player_id = ?
        AND p.membership_status = 'approved'
      GROUP BY s.id, s.name, c.id, c.name
      ORDER BY s.name ASC, c.name ASC
    `).bind(playerId).all();

    return Response.json({
      results
    }, {
      headers: {
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to load course averages",
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

   await env.DB.batch([
  env.DB.prepare(`
    DELETE FROM golf_day_notice
    WHERE golf_day_id = ?
  `).bind(golfDayId),

  env.DB.prepare(`
    DELETE FROM results
    WHERE golf_day_id = ?
  `).bind(golfDayId),

  env.DB.prepare(`
    DELETE FROM prepared_handicaps
    WHERE golf_day_id = ?
  `).bind(golfDayId),

    env.DB.prepare(`
    UPDATE planned_golf_days
    SET
      course_id = NULL,
      golf_day_id = NULL,
      status = 'planned'
    WHERE golf_day_id = ?
  `).bind(golfDayId),

  env.DB.prepare(`
    DELETE FROM golf_days
    WHERE id = ?
  `).bind(golfDayId)
]);

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
    COALESCE(r.handicap, ph.handicap, p.handicap) AS handicap,
    r.stableford_score
  FROM players p
  LEFT JOIN results r
    ON r.player_id = p.id
    AND r.golf_day_id = ?
  LEFT JOIN prepared_handicaps ph
  ON ph.player_id = p.id
  AND ph.golf_day_id = ?
  WHERE p.membership_status = 'approved'
    AND p.active = 1
  ORDER BY p.last_name, p.first_name
`).bind(golfDayId, golfDayId).all();

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

if (
  url.pathname === "/api/admin/amend-results" &&
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
    const amendments = body.amendments;

    if (
      !Number.isInteger(golfDayId) ||
      golfDayId <= 0 ||
      !Array.isArray(amendments) ||
      amendments.length === 0
    ) {
      return Response.json(
        { error: "Invalid amendment data." },
        { status: 400 }
      );
    }

    const golfDay = await env.DB.prepare(`
      SELECT id, results_submitted
      FROM golf_days
      WHERE id = ?
    `).bind(golfDayId).first();

    if (!golfDay || Number(golfDay.results_submitted) !== 1) {
      return Response.json(
        { error: "Golf Day results have not been submitted." },
        { status: 409 }
      );
    }

    const statements = [];
    const seenPlayers = new Set();

    for (const item of amendments) {
      const playerId = Number(item.player_id);
      const handicap = Number(item.handicap);
      const score = item.stableford_score;

      if (
        !Number.isInteger(playerId) ||
        playerId <= 0 ||
        seenPlayers.has(playerId) ||
        item.handicap === null ||
        item.handicap === undefined ||
        item.handicap === "" ||
        !Number.isFinite(handicap) ||
        handicap < 0 ||
        handicap > 54
      ) {
        return Response.json(
          { error: "Invalid player or handicap." },
          { status: 400 }
        );
      }

      seenPlayers.add(playerId);

      if (score === null || score === "") {
        // Remove an incorrectly entered result.
        statements.push(
          env.DB.prepare(`
            DELETE FROM results
            WHERE golf_day_id = ?
              AND player_id = ?
          `).bind(golfDayId, playerId)
        );
      } else {
        const points = Number(score);

        if (!Number.isInteger(points) || points < 0) {
          return Response.json(
            { error: "Invalid Stableford score." },
            { status: 400 }
          );
        }

        statements.push(
          env.DB.prepare(`
            INSERT INTO results
              (golf_day_id, player_id, stableford_score, handicap)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(golf_day_id, player_id)
            DO UPDATE SET
              stableford_score = excluded.stableford_score,
              handicap = excluded.handicap
          `).bind(
            golfDayId,
            playerId,
            points,
            handicap
          )
        );
      }

      // Preserve the historical handicap separately.
      statements.push(
        env.DB.prepare(`
          INSERT INTO prepared_handicaps
            (golf_day_id, player_id, handicap)
          VALUES (?, ?, ?)
          ON CONFLICT(golf_day_id, player_id)
          DO UPDATE SET
            handicap = excluded.handicap,
            updated_at = CURRENT_TIMESTAMP
        `).bind(golfDayId, playerId, handicap)
      );
    }

    await env.DB.batch(statements);

    return Response.json({
      success: true,
      amended: amendments.length
    });

  } catch (error) {
    return Response.json(
      { error: "Unable to amend Golf Day results." },
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

    if (
      !Number.isInteger(golfDayId) ||
      golfDayId <= 0 ||
      !Array.isArray(results) ||
      results.length === 0
    ) {
      return Response.json(
        { error: "Invalid results data." },
        { status: 400 }
      );
    }

    const golfDay = await env.DB.prepare(`
      SELECT id, play_date, results_submitted
      FROM golf_days
      WHERE id = ?
      LIMIT 1
    `).bind(golfDayId).first();

    if (!golfDay) {
      return Response.json(
        { error: "Golf Day not found." },
        { status: 404 }
      );
    }

    if (golfDay.results_submitted === 1) {
      return Response.json(
        { error: "Results for this Golf Day have already been submitted." },
        { status: 409 }
      );
    }

   // Read the latest handicaps submitted from the screen.
const submittedHandicaps = body.handicaps;

if (
  !Array.isArray(submittedHandicaps) ||
  submittedHandicaps.length === 0
) {
  return Response.json(
    { error: "No handicaps supplied." },
    { status: 400 }
  );
}

const preparedMap = new Map();

for (const item of submittedHandicaps) {
  const playerId = Number(item.player_id);
  const handicap = Number(item.handicap);

  if (
    !Number.isInteger(playerId) ||
    playerId <= 0 ||
    item.handicap === null ||
    item.handicap === undefined ||
    item.handicap === "" ||
    !Number.isFinite(handicap) ||
    handicap < 0 ||
    handicap > 54 ||
    preparedMap.has(playerId)
  ) {
    return Response.json(
      { error: "Invalid or duplicate handicap." },
      { status: 400 }
    );
  }

  preparedMap.set(playerId, handicap);
}

    // Validate every result before writing anything.
    const seenPlayers = new Set();
    const validatedResults = [];

    for (const result of results) {
      const playerId = Number(result.player_id);
      const score = Number(result.stableford_score);
      const handicap = preparedMap.get(playerId);

      if (
        !Number.isInteger(playerId) ||
        playerId <= 0 ||
        seenPlayers.has(playerId) ||
        result.stableford_score === null ||
        result.stableford_score === "" ||
        !Number.isInteger(score) ||
        score < 0 ||
        !Number.isFinite(handicap) ||
        handicap < 0 ||
        handicap > 54
      ) {
        return Response.json(
          { error: "Invalid or duplicate player result." },
          { status: 400 }
        );
      }

      seenPlayers.add(playerId);

      validatedResults.push({
        playerId,
        score,
        handicap
      });
    }

    const statements = [];

   // Abort the batch if this Golf Day is already submitted.
statements.push(
  env.DB.prepare(`
    SELECT CASE
      WHEN results_submitted = 0 THEN 1
      ELSE json_extract('invalid', '$')
    END
    FROM golf_days
    WHERE id = ?
  `).bind(golfDayId)
);

    // Mark the Golf Day as submitted.
statements.push(
  env.DB.prepare(`
    UPDATE golf_days
    SET results_submitted = 1
    WHERE id = ?
      AND results_submitted = 0
  `).bind(golfDayId)
);

// Save the final handicaps for this Golf Day.
// These are included in the same atomic database batch.
for (const [playerId, handicap] of preparedMap) {
  statements.push(
    env.DB.prepare(`
      INSERT INTO prepared_handicaps
        (golf_day_id, player_id, handicap)
      VALUES (?, ?, ?)
      ON CONFLICT(golf_day_id, player_id)
      DO UPDATE SET
        handicap = excluded.handicap,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      golfDayId,
      playerId,
      handicap
    )
  );
}
    
    // Save all Stableford results.
    for (const result of validatedResults) {
      statements.push(
        env.DB.prepare(`
          INSERT INTO results
            (golf_day_id, player_id, stableford_score, handicap)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(golf_day_id, player_id)
          DO UPDATE SET
            stableford_score = excluded.stableford_score,
            handicap = excluded.handicap
        `).bind(
          golfDayId,
          result.playerId,
          result.score,
          result.handicap
        )
      );
    }

      
    // All statements succeed or all are rolled back.
    await env.DB.batch(statements);

    return Response.json({
  success: true,
  saved: validatedResults.length,
  handicaps_updated: preparedMap.size
});

  } catch (error) {
    return Response.json(
      {
        error: "Unable to submit Golf Day results.",
        details: error.message
      },
      { status: 500 }
    );
  }
}


// ========================================
// SAVE PREPARED HANDICAPS
// ========================================

if (
  url.pathname === "/api/admin/prepared-handicaps" &&
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
    const handicaps = body.handicaps;

    if (
      !Number.isInteger(golfDayId) ||
      golfDayId <= 0 ||
      !Array.isArray(handicaps)
    ) {
      return Response.json(
        { error: "Invalid handicap data." },
        { status: 400 }
      );
    }

    const golfDay = await env.DB.prepare(`
  SELECT id, results_submitted
  FROM golf_days
  WHERE id = ?
`).bind(golfDayId).first();

    if (!golfDay) {
      return Response.json(
        { error: "Golf Day not found." },
        { status: 404 }
      );
    }
    if (golfDay.results_submitted === 1) {
  return Response.json(
    {
      error: "Cannot change handicaps. Golf Day results have already been submitted."
    },
    { status: 409 }
  );
}

    const statements = [];

    for (const item of handicaps) {
      const playerId = Number(item.player_id);
      const handicap = Number(item.handicap);

      if (
        !Number.isInteger(playerId) ||
        playerId <= 0 ||
        item.handicap === null ||
        item.handicap === "" ||
        !Number.isFinite(handicap) ||
handicap < 0 ||
handicap > 54
      ) {
        return Response.json(
          { error: "Invalid player or handicap." },
          { status: 400 }
        );
      }

      statements.push(
        env.DB.prepare(`
          INSERT INTO prepared_handicaps
            (golf_day_id, player_id, handicap)
          VALUES (?, ?, ?)
          ON CONFLICT(golf_day_id, player_id)
          DO UPDATE SET
            handicap = excluded.handicap,
            updated_at = CURRENT_TIMESTAMP
        `).bind(golfDayId, playerId, handicap)
      );
            statements.push(
        env.DB.prepare(`
          UPDATE players
          SET handicap = ?
          WHERE id = ?
        `).bind(handicap, playerId)
      );
    }

    if (statements.length) {
      await env.DB.batch(statements);
    }

    return Response.json({
      success: true,
      saved: handicaps.length
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to save prepared handicaps.",
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
  WHERE LOWER(TRIM(first_name)) = LOWER(TRIM(?))
    AND LOWER(TRIM(last_name)) = LOWER(TRIM(?))
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
        gd.id AS golf_day_id,
        gd.play_date,
        c.name AS course_name,
        c.location AS course_location,
        n.first_tee_time,
        n.message,
        n.updated_at
      FROM golf_days gd
      JOIN courses c
        ON c.id = gd.course_id
      JOIN golf_day_notice n
  ON n.golf_day_id = gd.id
WHERE gd.play_date >= date('now')
      ORDER BY gd.play_date ASC
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
// CURRENT SEASON INFORMATION
// ========================================

if (url.pathname === "/api/current-season") {

  try {

    const season = await env.DB.prepare(`
      SELECT id, name, start_date, end_date, minimum_rounds
      FROM seasons
      WHERE status = 'current'
      LIMIT 1
    `).first();

    return Response.json({
      season: season || null
    });

  } catch (error) {

    return Response.json(
      { error: "Unable to load current season." },
      { status: 500 }
    );

  }
}

// ========================================
// END SEASON ELIGIBILITY CHECK
// ========================================

if (url.pathname === "/api/end-season/check") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {

    const season = await env.DB.prepare(`
      SELECT id, name, end_date
      FROM seasons
      WHERE status = 'current'
      LIMIT 1
    `).first();

    if (!season) {
      return Response.json({
        allowed: false,
        reason: "No current season found."
      });
    }

    const outstanding = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM golf_days
      WHERE season_id = ?
        AND COALESCE(results_submitted, 0) = 0
    `).bind(season.id).first();

    const dateReached =
      new Date().toISOString().slice(0, 10) >= season.end_date;

    const outstandingCount = Number(outstanding.total);

    const allowed =
      dateReached && outstandingCount === 0;

    return Response.json({
      season: season.name,
      end_date: season.end_date,
      allowed,
      outstanding_golf_days: outstandingCount,
      reason: !dateReached
        ? "Season cannot close before 31 December."
        : outstandingCount > 0
          ? "Some Golf Day results have not been submitted."
          : "Season is ready to close."
    });

  } catch (error) {

    return Response.json(
      { error: "Unable to check season closure." },
      { status: 500 }
    );

  }
}

// ========================================
// END SEASON - STANDINGS PREVIEW
// ========================================

if (url.pathname === "/api/end-season/preview") {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  try {

    const season = await env.DB.prepare(`
      SELECT id, name, minimum_rounds
      FROM seasons
      WHERE status = 'current'
      LIMIT 1
    `).first();

    if (!season) {
      return Response.json(
        { error: "No current season found." },
        { status: 404 }
      );
    }

    const { results: players } = await env.DB.prepare(`
      SELECT
        p.id AS player_id,
        p.first_name,
        p.last_name,
        COUNT(r.id) AS rounds_played,
        ROUND(AVG(r.stableford_score), 2) AS average_score
      FROM players p
      LEFT JOIN results r
        ON r.player_id = p.id
        AND r.golf_day_id IN (
          SELECT id
          FROM golf_days
          WHERE season_id = ?
        )
      WHERE p.active = 1
      GROUP BY p.id, p.first_name, p.last_name
      ORDER BY
        average_score DESC,
        p.last_name ASC,
        p.first_name ASC
    `).bind(season.id).all();

    let position = 0;

    const standings = players.map(player => {

      const eligible =
        player.rounds_played >= season.minimum_rounds;

      return {
        ...player,
        eligible,
        final_position: eligible ? ++position : null
      };

    });

    return Response.json({
      season: season.name,
      minimum_rounds: season.minimum_rounds,
      standings
    }, {
      headers: { "Cache-Control": "no-store" }
    });

  } catch (error) {

    return Response.json(
      { error: "Unable to preview final standings." },
      { status: 500 }
    );

  }
}

// ========================================
// END SEASON - CLOSE
// ========================================

if (
  url.pathname === "/api/end-season/close" &&
  request.method === "POST"
) {

  if (!isAdmin) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

    const season = await env.DB.prepare(`
    SELECT id, name, end_date, minimum_rounds
    FROM seasons
    WHERE status = 'current'
    LIMIT 1
  `).first();

  if (!season) {
    return Response.json(
      { error: "No current season found." },
      { status: 400 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  if (today < season.end_date) {
    return Response.json(
      { error: "Season cannot close before 31 December." },
      { status: 400 }
    );
  }

  const outstanding = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM golf_days
    WHERE season_id = ?
      AND COALESCE(results_submitted, 0) = 0
  `).bind(season.id).first();

  if (Number(outstanding.total) > 0) {
    return Response.json(
      { error: "Some Golf Day results have not been submitted." },
      { status: 400 }
    );
  }

    const existingArchive = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM season_final_standings
    WHERE season_id = ?
  `).bind(season.id).first();

  if (Number(existingArchive.total) > 0) {
    return Response.json(
      { error: "This season has already been archived." },
      { status: 409 }
    );
  }

  const nextYear =
    Number(season.end_date.slice(0, 4)) + 1;

  const nextSeasonName = `${nextYear} Season`;

  const existingNextSeason = await env.DB.prepare(`
    SELECT id
    FROM seasons
    WHERE name = ?
       OR start_date = ?
    LIMIT 1
  `).bind(
    nextSeasonName,
    `${nextYear}-01-01`
  ).first();

  if (existingNextSeason) {
    return Response.json(
      { error: "The next season already exists." },
      { status: 409 }
    );
  }

  const { results: players } = await env.DB.prepare(`
  SELECT
    p.id AS player_id,
    COUNT(r.id) AS rounds_played,
    ROUND(AVG(r.stableford_score), 2) AS average_score
  FROM players p
  LEFT JOIN results r
    ON r.player_id = p.id
    AND r.golf_day_id IN (
      SELECT id
      FROM golf_days
      WHERE season_id = ?
    )
  WHERE p.active = 1
GROUP BY p.id, p.first_name, p.last_name
HAVING COUNT(r.id) > 0
ORDER BY
    average_score DESC,
    p.last_name ASC,
    p.first_name ASC
`).bind(season.id).all();

let finalPosition = 0;

const finalStandings = players.map(player => {
  const eligible =
    player.rounds_played >= season.minimum_rounds;

  return {
    player_id: player.player_id,
    rounds_played: player.rounds_played,
    average_score: player.average_score,
    eligible: eligible ? 1 : 0,
    final_position: eligible ? ++finalPosition : null
  };
});

const archiveStatements = finalStandings.map(player =>
  env.DB.prepare(`
    INSERT INTO season_final_standings (
      season_id,
      player_id,
      final_position,
      rounds_played,
      average_score,
      eligible
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    season.id,
    player.player_id,
    player.final_position,
    player.rounds_played,
    player.average_score,
    player.eligible
  )
);

const rolloverStatements = [
  env.DB.prepare(`
    UPDATE seasons
    SET status = 'completed'
    WHERE id = ?
  AND status = 'current'
  AND end_date <= DATE('now')
  AND NOT EXISTS (
    SELECT 1
    FROM golf_days
    WHERE season_id = ?
      AND COALESCE(results_submitted, 0) = 0
  )
  `).bind(season.id, season.id),

  env.DB.prepare(`
    INSERT INTO seasons (
      name,
      start_date,
      end_date,
      minimum_rounds,
      status
    )
    SELECT ?, ?, ?, ?, 'current'
WHERE EXISTS (
  SELECT 1
  FROM seasons
  WHERE id = ?
    AND status = 'completed'
)
AND NOT EXISTS (
  SELECT 1
  FROM seasons
  WHERE name = ?
)

  `).bind(
  nextSeasonName,
  `${nextYear}-01-01`,
  `${nextYear}-12-31`,
  season.minimum_rounds,
    season.id,
  nextSeasonName
)
];

if (finalStandings.length === 0) {
  return Response.json(
    { error: "Cannot close a season without final standings." },
    { status: 400 }
  );
}

const safetyStatement = env.DB.prepare(`
  SELECT CASE
    WHEN (
      SELECT COUNT(*)
      FROM seasons
      WHERE id = ?
        AND status = 'current'
        AND end_date <= DATE('now')
    ) = 1
    AND NOT EXISTS (
      SELECT 1
      FROM golf_days
      WHERE season_id = ?
        AND COALESCE(results_submitted, 0) = 0
    )
    THEN 1
    ELSE json_extract('invalid', '$')
  END
`).bind(season.id, season.id);
  
const verifyRollover = env.DB.prepare(`
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM seasons
      WHERE id = ?
        AND status = 'completed'
    )
    AND EXISTS (
      SELECT 1
      FROM seasons
      WHERE name = ?
        AND status = 'current'
    )
    THEN 1
    ELSE json_extract('invalid', '$')
  END
`).bind(season.id, nextSeasonName);

const seasonTransaction = [
  safetyStatement,
  ...archiveStatements,
  ...rolloverStatements,
  verifyRollover
];

try {

  await env.DB.batch(seasonTransaction);

  return Response.json({
    success: true,
    message: `${season.name} closed successfully. ${nextSeasonName} created.`
  });

} catch (error) {

  console.error("Season closing failed:", error);

  return Response.json(
    { error: "Unable to close the season. No changes were saved." },
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
        const requestedSeason = url.searchParams.get("season");

const season = await env.DB.prepare(`
  SELECT id, name, minimum_rounds, status
FROM seasons
  WHERE
    (? IS NULL AND status = 'current')
    OR
    (? IS NOT NULL AND id = ?)
  LIMIT 1
`).bind(
  requestedSeason,
  requestedSeason,
  requestedSeason
).first();

        if (!season) {
          return Response.json(
            { error: "No current season has been set." },
            { status: 500 }
          );
        }

        let { results } = await env.DB.prepare(`
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

        let archivedStandings = [];

if (season.status === "completed") {

  const archive = await env.DB.prepare(`
    SELECT
      player_id,
      final_position,
      rounds_played,
      average_score,
      eligible
    FROM season_final_standings
    WHERE season_id = ?
    ORDER BY
      average_score DESC,
      final_position ASC
  `).bind(season.id).all();

  archivedStandings = archive.results;

  const archivedPlayerIds = new Set(
  archivedStandings.map(player => Number(player.player_id))
);

results = results.filter(player =>
  archivedPlayerIds.has(Number(player.id))
);

}

if (season.status === "completed" && archivedStandings.length > 0) {

  const archivedByPlayer = new Map(
    archivedStandings.map(player => [
      player.player_id,
      player
    ])
  );

  for (const player of results) {

    const archived = archivedByPlayer.get(player.id);

    if (archived) {
      player.played = archived.rounds_played;
      player.average_score = archived.average_score;
      player.eligible = archived.eligible === 1;
      player.final_position = archived.final_position;
    }
  }
}
        
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

          const previousRecent = await env.DB.prepare(`
  SELECT r.stableford_score
  FROM results r
  JOIN golf_days gd
    ON gd.id = r.golf_day_id
  WHERE r.player_id = ?
    AND gd.season_id = ?
    AND gd.id <> (
      SELECT gd2.id
      FROM golf_days gd2
      JOIN results r2 ON r2.golf_day_id = gd2.id
      WHERE gd2.season_id = ?
      ORDER BY gd2.play_date DESC, gd2.id DESC
      LIMIT 1
    )
  ORDER BY gd.play_date DESC, gd.id DESC
  LIMIT 5
`).bind(player.id, season.id, season.id).all();

player.previous_5 = previousRecent.results.map(
  row => row.stableford_score
);

          player.previous_form_average =
  player.previous_5.length === 5
    ? player.previous_5.reduce(
        (total, score) => total + Number(score), 0
      ) / 5
    : null;
          
          player.minimum_rounds = season.minimum_rounds;

          if (season.status !== "completed" || player.final_position === undefined) {
  player.eligible = player.played >= season.minimum_rounds;
}
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

// ========================================
// CLUB RECORDS
// ========================================

if (url.pathname === "/api/club-records") {
  try {

   const highestScore = await env.DB.prepare(`
  SELECT
    p.first_name,
    p.last_name,
    r.stableford_score,
    gd.play_date,
    c.name AS course_name
  FROM results r
  JOIN players p
    ON p.id = r.player_id
  JOIN golf_days gd
    ON gd.id = r.golf_day_id
  JOIN courses c
    ON c.id = gd.course_id
  WHERE COALESCE(gd.results_submitted, 0) = 1
    AND r.stableford_score = (
      SELECT MAX(r2.stableford_score)
      FROM results r2
      JOIN golf_days gd2
        ON gd2.id = r2.golf_day_id
      WHERE COALESCE(gd2.results_submitted, 0) = 1
    )
  ORDER BY gd.play_date ASC, p.last_name ASC
`).all();

const personalBests = await env.DB.prepare(`
  SELECT
    p.id AS player_id,
    p.first_name,
    p.last_name,
    MAX(r.stableford_score) AS best_score
  FROM players p
  JOIN results r
    ON r.player_id = p.id
  JOIN golf_days gd
    ON gd.id = r.golf_day_id
  WHERE COALESCE(gd.results_submitted, 0) = 1
  GROUP BY
    p.id,
    p.first_name,
    p.last_name
  ORDER BY
    p.last_name,
    p.first_name
`).all();
    
    return Response.json({
  highest_stableford: highestScore.results,
  personal_bests: personalBests.results
}, {
      headers: {
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {
    return Response.json(
      { error: "Unable to load club records." },
      { status: 500 }
    );
  }
}
    
// ========================================
// ADMIN FULL LEAGUE TABLE
// ========================================

if (url.pathname === "/api/full-league") {
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

    const requestedSeason = url.searchParams.get("season");

const season = await env.DB.prepare(`
  SELECT id, name, minimum_rounds, status
FROM seasons
  WHERE
    (? IS NULL AND status = 'current')
    OR
    (? IS NOT NULL AND id = ?)
  LIMIT 1
`).bind(
  requestedSeason,
  requestedSeason,
  requestedSeason
).first();

    if (!season) {
      return Response.json(
        { error: "No current season has been set." },
        { status: 500 }
      );
    }

    const golfDays = await env.DB.prepare(`
      SELECT
        gd.id,
        gd.play_date,
        c.name AS course_name
      FROM golf_days gd
      JOIN courses c
        ON c.id = gd.course_id
      WHERE gd.season_id = ?
      ORDER BY gd.play_date DESC
    `).bind(season.id).all();

const latestPlayedDay = await env.DB.prepare(`
  SELECT gd.id, gd.play_date
  FROM golf_days gd
  JOIN results r
    ON r.golf_day_id = gd.id
  WHERE gd.season_id = ?
  GROUP BY gd.id, gd.play_date
  ORDER BY gd.play_date DESC, gd.id DESC
  LIMIT 1
`).bind(season.id).first();

    const previousStandings = latestPlayedDay
  ? await env.DB.prepare(`
      SELECT
        p.id,
        COUNT(r.id) AS played,
        ROUND(AVG(r.stableford_score), 2) AS average_score
      FROM players p
      LEFT JOIN results r
        ON r.player_id = p.id
        AND r.golf_day_id IN (
          SELECT id
          FROM golf_days
          WHERE season_id = ?
            AND (
              play_date < ?
              OR (play_date = ? AND id < ?)
            )
        )
      WHERE p.active = 1
      GROUP BY p.id
      HAVING COUNT(r.id) >= ?
      ORDER BY
        average_score DESC,
        p.last_name ASC,
        p.first_name ASC
    `).bind(
      season.id,
      latestPlayedDay.play_date,
      latestPlayedDay.play_date,
      latestPlayedDay.id,
      season.minimum_rounds
    ).all()
  : { results: [] };

    const previousPositions = new Map();

previousStandings.results.forEach((player, index) => {
  previousPositions.set(player.id, index + 1);
});

    
    
    let players = await env.DB.prepare(`
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

    if (season.status === "completed") {

  const archive = await env.DB.prepare(`
    SELECT
      player_id,
      final_position,
      rounds_played,
      average_score,
      eligible
    FROM season_final_standings
    WHERE season_id = ?
  `).bind(season.id).all();

  const archivedByPlayer = new Map(
    archive.results.map(row => [
      Number(row.player_id),
      row
    ])
  );

  players.results = players.results
    .filter(player =>
      archivedByPlayer.has(Number(player.id))
    )
    .map(player => {
      const archived = archivedByPlayer.get(Number(player.id));

      return {
        ...player,
        played: archived.rounds_played,
        average_score: archived.average_score,
        final_position: archived.final_position,
                eligible: Boolean(archived.eligible)
      };
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) {
        return a.eligible ? -1 : 1;
      }

      if (a.eligible && b.eligible) {
        return a.final_position - b.final_position;
      }

      return Number(b.average_score) - Number(a.average_score);
    });

}

    let currentPosition = 0;

players.results.forEach(player => {
    if (season.status === "completed") {
    player.position_change = null;
    return;
  }
  if (player.played < season.minimum_rounds) {
    player.position_change = null;
    return;
  }

  currentPosition++;

  const previousPosition = previousPositions.get(player.id);

  player.position_change =
    previousPosition === undefined
      ? "NEW"
      : previousPosition - currentPosition;
});

    const scores = await env.DB.prepare(`
      SELECT
        r.player_id,
        r.golf_day_id,
        r.stableford_score
      FROM results r
      JOIN golf_days gd
        ON gd.id = r.golf_day_id
      WHERE gd.season_id = ?
    `).bind(season.id).all();

    return Response.json({
      season: season.name,
      minimum_rounds: season.minimum_rounds,
      golf_days: golfDays.results,
      players: players.results,
      scores: scores.results
    }, {
      headers: {
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to load admin league table",
        details: error.message
      },
      { status: 500 }
    );
  }
}

 

// ========================================
// VERSION CONTROL
// ========================================

if (url.pathname === "/api/versions" && request.method === "GET") {
  try {

    const admin = await env.DB.prepare(`
      SELECT id
      FROM players
      WHERE LOWER(email) = LOWER(?)
        AND membership_status = 'approved'
        AND role = 'admin'
      LIMIT 1
    `).bind(email).first();

    if (!admin) {
      return Response.json(
        { error: "Administrator access required." },
        { status: 403 }
      );
    }

    const { results } = await env.DB.prepare(`
      SELECT
        id,
        version_number,
        version_date,
        title,
        description
      FROM versions
      ORDER BY version_number DESC
    `).all();

    return Response.json({
      versions: results
    }, {
      headers: {
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to load versions",
        details: error.message
      },
      { status: 500 }
    );
  }
}

if (url.pathname === "/api/versions" && request.method === "POST") {
  try {

    const admin = await env.DB.prepare(`
      SELECT id
      FROM players
      WHERE LOWER(email) = LOWER(?)
        AND membership_status = 'approved'
        AND role = 'admin'
      LIMIT 1
    `).bind(email).first();

    if (!admin) {
      return Response.json(
        { error: "Administrator access required." },
        { status: 403 }
      );
    }

    const data = await request.json();

    const versionNumber = data.version_number?.trim();
    const versionDate = data.version_date;
    const title = data.title?.trim();
    const description = data.description?.trim();

    if (!versionNumber || !versionDate || !title || !description) {
      return Response.json(
        { error: "All version fields are required." },
        { status: 400 }
      );
    }

    await env.DB.prepare(`
      INSERT INTO versions (
        version_number,
        version_date,
        title,
        description
      )
      VALUES (?, ?, ?, ?)
    `).bind(
      versionNumber,
      versionDate,
      title,
      description
    ).run();

    return Response.json({
      success: true
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to save version",
        details: error.message
      },
      { status: 500 }
    );
  }
}

if (url.pathname === "/api/versions" && request.method === "PUT") {
  try {

    const admin = await env.DB.prepare(`
      SELECT id
      FROM players
      WHERE LOWER(email) = LOWER(?)
        AND membership_status = 'approved'
        AND role = 'admin'
      LIMIT 1
    `).bind(email).first();

    if (!admin) {
      return Response.json(
        { error: "Administrator access required." },
        { status: 403 }
      );
    }

    const data = await request.json();

    const id = data.id;
    const versionNumber = data.version_number?.trim();
    const versionDate = data.version_date;
    const title = data.title?.trim();
    const description = data.description?.trim();

    if (!id || !versionNumber || !versionDate || !title || !description) {
      return Response.json(
        { error: "All version fields are required." },
        { status: 400 }
      );
    }

    await env.DB.prepare(`
      UPDATE versions
      SET
        version_number = ?,
        version_date = ?,
        title = ?,
        description = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      versionNumber,
      versionDate,
      title,
      description,
      id
    ).run();

    return Response.json({
      success: true
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to update version",
        details: error.message
      },
      { status: 500 }
    );
  }
}

if (url.pathname === "/api/latest-version" && request.method === "GET") {
  try {

    const version = await env.DB.prepare(`
      SELECT version_number
      FROM versions
      ORDER BY version_number DESC
      LIMIT 1
    `).first();

    return Response.json({
      version_number: version?.version_number || ""
    }, {
      headers: {
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {

    return Response.json(
      { error: "Unable to load latest version" },
      { status: 500 }
    );
  }
}
    
    return env.ASSETS.fetch(request);
  }
};
