// /components/tabbar.js

export function loadTabbar() {
  const container = document.getElementById("appTabbar");
  if (!container) return;

  const current = window.location.pathname;

  const tabs = [
    { icon: "🏠", label: "Inicio", url: "/dashboard/index.html" },
    { icon: "📘", label: "Retos", url: "/curso/index.html" },
    { icon: "🤖", label: "Coach", url: "/coach/chat.html" },
    { icon: "👤", label: "Perfil", url: "/perfil/index.html" }
  ];

  const items = tabs.map(tab => {
    const active = current.includes(tab.url) ? "active" : "";
    return `
      <button class="tab-item ${active}" onclick="window.location.href='${tab.url}'">
        <div class="tab-icon">${tab.icon}</div>
        <span>${tab.label}</span>
      </button>
    `;
  }).join("");

  container.innerHTML = `
    <nav class="tabbar">
      ${items}
    </nav>
  `;
}
