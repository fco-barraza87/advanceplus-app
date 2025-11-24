// admin-users.js

// ⚠️ Conecta esto con tu cliente real de Supabase.
// Si ya tienes window.supabase, esto funcionará.
// Si usas otra cosa, cambia esta función.
function getSupabaseClient() {
  if (window.supabase) return window.supabase;
  throw new Error(
    "No se encontró el cliente de Supabase. Conecta tu instancia en admin-users.js"
  );
}

const supabase = getSupabaseClient();

let currentUserProfile = null;
let currentRole = null;
let currentUsers = [];
let currentSelectedUser = null;

document.addEventListener("DOMContentLoaded", () => {
  initModule().catch((err) => {
    console.error(err);
    showAccessError("Error inicializando módulo de usuarios.");
  });
});

async function initModule() {
  await loadCurrentUserProfile();
  setupUIEvents();
  await loadUsers();
}

async function loadCurrentUserProfile() {
  const rolePill = document.getElementById("current-role-pill");

  const {
    data: {
      session: { user } = { user: null },
    } = {},
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !user) {
    showAccessError("No hay sesión activa.");
    rolePill.textContent = "Sin sesión";
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, xp_total, streak_current, streak_best, created_at"
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    showAccessError("No se pudo obtener el perfil del usuario.");
    rolePill.textContent = "Error perfil";
    return;
  }

  currentUserProfile = profile;
  currentRole = profile.role;

  updateRolePill(rolePill, currentRole);

  if (!["admin", "coach"].includes(currentRole)) {
    showAccessError(
      "Este módulo está disponible solo para usuarios con rol admin o coach."
    );
  } else {
    hideAccessError();
  }
}

function updateRolePill(elem, role) {
  elem.classList.remove("role-pill--admin", "role-pill--coach");
  if (role === "admin") {
    elem.classList.add("role-pill--admin");
    elem.textContent = "Admin";
  } else if (role === "coach") {
    elem.classList.add("role-pill--coach");
    elem.textContent = "Coach";
  } else {
    elem.textContent = role || "Sin rol";
  }
}

function showAccessError(message) {
  const section = document.getElementById("access-message");
  const p = section.querySelector("p");
  if (p) p.innerHTML = message;
  section.classList.remove("access-message--hidden");
}

function hideAccessError() {
  const section = document.getElementById("access-message");
  section.classList.add("access-message--hidden");
}

/* -------- Eventos UI -------- */

function setupUIEvents() {
  const searchInput = document.getElementById("search-input");
  const roleFilter = document.getElementById("role-filter");
  const languageFilter = document.getElementById("language-filter");
  const refreshBtn = document.getElementById("refresh-users");

  searchInput.addEventListener("input", debounce(loadUsers, 300));
  roleFilter.addEventListener("change", () => loadUsers());
  languageFilter.addEventListener("change", () => loadUsers());
  refreshBtn.addEventListener("click", () => loadUsers());

  const closeDetailBtn = document.getElementById("close-detail-panel");
  closeDetailBtn.addEventListener("click", closeDetailPanel);

  setupDetailTabs();
  setupProfileForm();
}

function setupDetailTabs() {
  const tabButtons = document.querySelectorAll(".detail-tab");
  const tabContents = document.querySelectorAll("[data-tab-content]");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.remove("detail-tab--active"));
      btn.classList.add("detail-tab--active");

      tabContents.forEach((c) => {
        if (c.dataset.tabContent === tab) {
          c.classList.remove("detail-tab-content--hidden");
        } else {
          c.classList.add("detail-tab-content--hidden");
        }
      });
    });
  });
}

/* -------- Carga de usuarios -------- */

async function loadUsers() {
  const loading = document.getElementById("users-loading");
  const emptyState = document.getElementById("users-empty-state");
  const tbody = document.getElementById("users-table-body");

  loading.classList.remove("loading-overlay--hidden");
  emptyState.classList.add("empty-state--hidden");
  tbody.innerHTML = "";

  const searchValue = document.getElementById("search-input").value.trim();
  const roleFilter = document.getElementById("role-filter").value;
  const languageFilter = document.getElementById("language-filter").value;

  let query = supabase
    .from("profiles")
    .select(
      "id, full_name, email, avatar_url, role, country, language, timezone, xp_total, streak_current, streak_best, updated_at"
    );

  if (roleFilter) {
    query = query.eq("role", roleFilter);
  }

  if (languageFilter) {
    query = query.eq("language", languageFilter);
  }

  // Búsqueda simple por nombre o email
  if (searchValue) {
    query = query.or(
      `full_name.ilike.%${searchValue}%,email.ilike.%${searchValue}%`
    );
  }

  query = query.order("created_at", { ascending: false }).limit(200);

  const { data, error } = await query;

  loading.classList.add("loading-overlay--hidden");

  if (error) {
    console.error("Error cargando usuarios:", error);
    emptyState.classList.remove("empty-state--hidden");
    emptyState.textContent = "Error al cargar usuarios.";
    return;
  }

  currentUsers = data || [];

  updateSummaryCards(currentUsers);

  if (!currentUsers.length) {
    emptyState.classList.remove("empty-state--hidden");
    emptyState.textContent = "No se encontraron usuarios para los filtros actuales.";
    return;
  }

  for (const user of currentUsers) {
    const tr = document.createElement("tr");
    tr.dataset.userId = user.id;
    tr.addEventListener("click", () => openUserDetail(user.id));

    const nameCell = document.createElement("td");
    nameCell.appendChild(createUserCell(user));
    tr.appendChild(nameCell);

    const emailCell = document.createElement("td");
    emailCell.textContent = user.email;
    tr.appendChild(emailCell);

    const roleCell = document.createElement("td");
    roleCell.appendChild(createRoleBadge(user.role));
    tr.appendChild(roleCell);

    const countryLangCell = document.createElement("td");
    countryLangCell.textContent = `${user.country || "—"} / ${
      user.language || "—"
    }`;
    tr.appendChild(countryLangCell);

    const tzCell = document.createElement("td");
    tzCell.textContent = user.timezone || "—";
    tr.appendChild(tzCell);

    const xpCell = document.createElement("td");
    xpCell.textContent = user.xp_total ?? "0";
    tr.appendChild(xpCell);

    const streakCell = document.createElement("td");
    streakCell.textContent = user.streak_current ?? "0";
    tr.appendChild(streakCell);

    const updatedCell = document.createElement("td");
    updatedCell.textContent = formatDateShort(user.updated_at);
    tr.appendChild(updatedCell);

    tbody.appendChild(tr);
  }
}

function updateSummaryCards(users) {
  const total = users.length;
  const admins = users.filter((u) => u.role === "admin").length;
  const coaches = users.filter((u) => u.role === "coach").length;
  const standardUsers = users.filter((u) => u.role === "user").length;

  setCardValue("card-total-users", total);
  setCardValue("card-admins", admins);
  setCardValue("card-coaches", coaches);
  setCardValue("card-users", standardUsers);
}

function setCardValue(cardId, value) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const span = card.querySelector("[data-value]");
  if (span) span.textContent = value ?? "0";
}

function createUserCell(user) {
  const wrapper = document.createElement("div");
  wrapper.className = "user-cell";

  const avatar = document.createElement("div");
  avatar.className = "user-avatar";

  if (user.avatar_url) {
    avatar.style.backgroundImage = `url(${user.avatar_url})`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
    avatar.textContent = "";
  } else {
    const initials = (user.full_name || user.email || "?")
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    avatar.textContent = initials;
  }

  const textWrapper = document.createElement("div");
  const nameEl = document.createElement("div");
  nameEl.className = "user-name";
  nameEl.textContent = user.full_name || "Sin nombre";

  const emailEl = document.createElement("div");
  emailEl.className = "user-email";
  emailEl.textContent = user.email;

  textWrapper.appendChild(nameEl);
  textWrapper.appendChild(emailEl);

  wrapper.appendChild(avatar);
  wrapper.appendChild(textWrapper);

  return wrapper;
}

function createRoleBadge(role) {
  const span = document.createElement("span");
  span.className = "role-badge";

  if (role === "admin") {
    span.classList.add("role-badge--admin");
  } else if (role === "coach") {
    span.classList.add("role-badge--coach");
  } else {
    span.classList.add("role-badge--user");
  }

  span.textContent = role || "user";
  return span;
}

/* -------- Panel de detalle -------- */

async function openUserDetail(userId) {
  const panel = document.getElementById("user-detail-panel");
  panel.classList.remove("detail-panel--hidden");

  const user = currentUsers.find((u) => u.id === userId);
  if (!user) return;

  currentSelectedUser = user;

  // Cabecera
  const avatar = document.getElementById("detail-avatar");
  const name = document.getElementById("detail-name");
  const email = document.getElementById("detail-email");
  const roleBadge = document.getElementById("detail-role-badge");
  const created = document.getElementById("detail-created");

  name.textContent = user.full_name || "Sin nombre";
  email.textContent = user.email || "";
  created.textContent = user.created_at
    ? `Creado el ${formatDateShort(user.created_at)}`
    : "";

  roleBadge.replaceWith(createRoleBadgeInPlace(roleBadge, user.role));

  // Avatar panel
  if (user.avatar_url) {
    avatar.style.backgroundImage = `url(${user.avatar_url})`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
    avatar.textContent = "";
  } else {
    const initials = (user.full_name || user.email || "?")
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    avatar.style.backgroundImage = "";
    avatar.textContent = initials;
  }

  // Rellenar formulario perfil
  fillProfileForm(user);

  // Cargar stats y progreso
  await Promise.all([loadUserStats(userId), loadUserProgressSummary(userId)]);

  applyFieldPermissions();
}

function closeDetailPanel() {
  const panel = document.getElementById("user-detail-panel");
  panel.classList.add("detail-panel--hidden");
  currentSelectedUser = null;
}

function createRoleBadgeInPlace(existingNode, role) {
  const badge = createRoleBadge(role);
  badge.id = existingNode.id;
  return badge;
}

function fillProfileForm(user) {
  const form = document.getElementById("profile-form");

  form.full_name.value = user.full_name || "";
  form.avatar_url.value = user.avatar_url || "";
  form.country.value = user.country || "";
  form.language.value = user.language || "es";
  form.timezone.value = user.timezone || "";
  form.preferred_focus_time.value = user.preferred_focus_time || "";

  try {
    form.goals_json.value = user.goals_json
      ? JSON.stringify(user.goals_json, null, 2)
      : "";
  } catch {
    form.goals_json.value = "";
  }

  try {
    form.notifications.value = user.notifications
      ? JSON.stringify(user.notifications, null, 2)
      : "";
  } catch {
    form.notifications.value = "";
  }
}

/* -------- Stats -------- */

async function loadUserStats(userId) {
  const levelEl = document.getElementById("stat-level");
  const xpEl = document.getElementById("stat-xp-total");
  const streakCurEl = document.getElementById("stat-streak-current");
  const streakBestEl = document.getElementById("stat-streak-best");
  const lastRewardEl = document.getElementById("stat-last-reward");
  const badgesContainer = document.getElementById("badges-container");

  levelEl.textContent = "–";
  xpEl.textContent = "–";
  streakCurEl.textContent = "–";
  streakBestEl.textContent = "–";
  lastRewardEl.textContent = "–";
  badgesContainer.innerHTML = "";

  const { data, error } = await supabase
    .from("user_stats")
    .select(
      "xp_total, streak_current, streak_best, level, badges, last_claimed_reward"
    )
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return;
  }

  levelEl.textContent = data.level ?? "1";
  xpEl.textContent = data.xp_total ?? "0";
  streakCurEl.textContent = data.streak_current ?? "0";
  streakBestEl.textContent = data.streak_best ?? "0";
  lastRewardEl.textContent = data.last_claimed_reward
    ? formatDateShort(data.last_claimed_reward)
    : "–";

  if (Array.isArray(data.badges)) {
    for (const badge of data.badges) {
      const pill = document.createElement("span");
      pill.className = "badge-pill";
      pill.textContent = badge;
      badgesContainer.appendChild(pill);
    }
  }
}

/* -------- Progreso (resumen) -------- */

async function loadUserProgressSummary(userId) {
  const container = document.getElementById("progress-summary");
  container.textContent = "Cargando progreso...";

  const { data, error } = await supabase
    .from("progress")
    .select("course_id, completed, xp, updated_at")
    .eq("user_id", userId);

  if (error) {
    console.error("Error cargando progreso:", error);
    container.textContent = "Error al cargar el progreso.";
    return;
  }

  if (!data || !data.length) {
    container.textContent = "Este usuario aún no tiene progreso registrado.";
    return;
  }

  const totalRecords = data.length;
  const completedCount = data.filter((r) => r.completed).length;
  const totalXP = data.reduce((acc, r) => acc + (r.xp || 0), 0);
  const lastUpdate = data
    .map((r) => r.updated_at)
    .filter(Boolean)
    .sort()
    .slice(-1)[0];

  container.innerHTML = `
    <p><strong>Registros de progreso:</strong> ${totalRecords}</p>
    <p><strong>Días completados:</strong> ${completedCount}</p>
    <p><strong>XP total en progreso:</strong> ${totalXP}</p>
    <p><strong>Última actividad:</strong> ${
      lastUpdate ? formatDateShort(lastUpdate) : "–"
    }</p>
    <p style="font-size:11px;opacity:0.75;margin-top:6px;">
      Detalle por curso se gestionará en el módulo de Cursos.
    </p>
  `;
}

/* -------- Guardado de perfil -------- */

function setupProfileForm() {
  const form = document.getElementById("profile-form");
  const status = document.getElementById("profile-save-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentSelectedUser) return;

    status.textContent = "Guardando...";
    const formData = new FormData(form);

    let goalsJsonValue = null;
    let notificationsValue = null;

    const goalsText = formData.get("goals_json");
    if (goalsText) {
      try {
        goalsJsonValue = JSON.parse(goalsText);
      } catch {
        status.textContent = "JSON de objetivos inválido.";
        return;
      }
    }

    const notifText = formData.get("notifications");
    if (notifText) {
      try {
        notificationsValue = JSON.parse(notifText);
      } catch {
        status.textContent = "JSON de notificaciones inválido.";
        return;
      }
    }

    const payload = {
      full_name: formData.get("full_name") || null,
      avatar_url: formData.get("avatar_url") || null,
      country: formData.get("country") || null,
      language: formData.get("language") || null,
      timezone: formData.get("timezone") || null,
      preferred_focus_time: formData.get("preferred_focus_time") || null,
      goals_json: goalsJsonValue,
      notifications: notificationsValue,
    };

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", currentSelectedUser.id);

    if (error) {
      console.error("Error guardando perfil:", error);
      status.textContent = "Error al guardar.";
      return;
    }

    status.textContent = "Guardado ✓";

    // Actualizar cache local
    Object.assign(currentSelectedUser, payload);
    const idx = currentUsers.findIndex((u) => u.id === currentSelectedUser.id);
    if (idx >= 0) {
      currentUsers[idx] = { ...currentUsers[idx], ...payload };
    }
    // Refrescar tabla
    await loadUsers();

    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  });
}

/* -------- Permisos de campos según rol -------- */

function applyFieldPermissions() {
  const form = document.getElementById("profile-form");
  const saveBtn = document.getElementById("save-profile");

  if (!["admin", "coach"].includes(currentRole)) {
    Array.from(form.elements).forEach((el) => (el.disabled = true));
    saveBtn.disabled = true;
    return;
  }

  // Admin: puede editar todo lo que está en el formulario
  if (currentRole === "admin") {
    Array.from(form.elements).forEach((el) => (el.disabled = false));
    saveBtn.disabled = false;
    return;
  }

  // Coach: solo estos campos (alineado con lo que definiste)
  const editableFields = new Set([
    "full_name",
    "avatar_url",
    "country",
    "language",
    "timezone",
    "goals_json",
    "preferred_focus_time",
    "notifications",
  ]);

  Array.from(form.elements).forEach((el) => {
    if (!el.name) return;
    el.disabled = !editableFields.has(el.name);
  });

  saveBtn.disabled = false;
}

/* -------- Utilidades -------- */

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function formatDateShort(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}
