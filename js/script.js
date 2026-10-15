/* Script interaksi dan pengisian konten website. Konten utama diedit di data.js. */
(() => {
  "use strict";
  const data = window.F4NTASTIC_DATA;
  if (!data) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const create = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  function safeLink(url) {
    // Hanya membuka link HTTP/HTTPS yang valid.
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function socialLink(item, compact = false) {
    const href = safeLink(item.url);
    if (!href) return null;
    const link = create("a", compact ? "social-chip" : "official-social-card");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.append(create("span", "social-label", item.label));
    if (!compact && item.handle) link.append(create("span", "social-handle", item.handle));
    link.append(create("span", "social-arrow", "↗"));
    link.setAttribute("aria-label", `${item.label} — buka tautan eksternal`);
    return link;
  }

  function setPhoto(container, path, label) {
    if (!container || !path) return;
    // Path foto harus mengarah ke file yang ada di folder proyek.
    const img = new Image();
    img.src = path;
    img.alt = label || "Foto F4NTASTIC";
    img.onload = () => {
      container.style.backgroundImage = `url("${path.replace(/["\\]/g, "")}")`;
      container.style.backgroundPosition = container.id === "founderPhoto" ? "center 22%" : "center 20%";
      container.classList.add("has-photo");
      const placeholder = container.querySelector(".photo-placeholder-content");
      if (placeholder) placeholder.remove();
    };
    img.onerror = () => console.warn(`Foto tidak ditemukan: ${path}`);
  }

  $("#heroSlogan").textContent = data.squad.slogan;
  $("#heroYear").textContent = data.squad.year;
  $("#aboutYear").textContent = data.squad.year;
  $("#visionText").textContent = data.squad.vision;
  $("#historyLead").textContent = data.squad.historyLead;
  $("#historyClosing").textContent = data.squad.historyClosing;
  $("#footerYear").textContent = new Date().getFullYear();

  const historyCopy = $("#historyCopy");
  data.squad.history.forEach(paragraph => historyCopy.append(create("p", "", paragraph)));

  const goalsGrid = $("#goalsGrid");
  data.squad.objectives.forEach((goal, index) => {
    const card = create("article", "goal-card reveal");
    card.append(create("span", "goal-number", String(index + 1).padStart(2, "0")));
    card.append(create("h4", "", goal.title));
    card.append(create("p", "", goal.text));
    goalsGrid.append(card);
  });

  const principlesList = $("#principlesList");
  data.squad.principles.forEach((principle, index) => {
    const row = create("div", "principle-row reveal");
    row.append(create("span", "principle-index", `0${index + 1}`));
    const text = create("div", "principle-text");
    text.append(create("h4", "", principle.name));
    text.append(create("p", "", principle.text));
    row.append(text);
    row.append(create("span", "principle-star", "✦"));
    principlesList.append(row);
  });

  $("#founderName").textContent = data.founder.name;
  $("#founderRole").textContent = data.founder.role.toUpperCase();
  $("#founderBio").textContent = data.founder.bio || "Bio belum ditambahkan.";
  setPhoto($("#founderPhoto"), data.founder.photo, data.founder.name);
  if (!data.founder.bio) $("#founderBio").hidden = true;
  const founderSocials = $("#founderSocials");
  data.founder.socials.forEach(item => {
    const link = socialLink(item, true);
    if (link) {
      link.prepend(create("span", "social-mark", ({Instagram:"◎",TikTok:"♪",Discord:"◈",YouTube:"▶"})[item.label] || "↗"));
      founderSocials.append(link);
    }
  });

  const renderAdminCard = (admin, index, target) => {
    const card = create("article", "admin-card reveal");
    const photo = create("div", "admin-photo photo-placeholder");
    photo.append(create("div", "photo-placeholder-content"));
    photo.querySelector(".photo-placeholder-content").append(
      create("span", "photo-icon", "＋"), create("span", "", "FOTO PROFIL"), create("small", "", "Foto belum ditambahkan")
    );
    photo.append(create("span", "admin-index", `F4N'T / ${String(index + 1).padStart(2, "0")}`));
    setPhoto(photo, admin.photo, admin.name);
    const details = create("div", "admin-details");
    details.append(create("p", "person-role", admin.role.toUpperCase()));
    details.append(create("h3", "", admin.name));
    if (admin.bio) details.append(create("p", "admin-bio", admin.bio));
    const socials = create("div", "social-links");
    (admin.socials || []).forEach(item => {
      const link = socialLink(item, true);
      if (link) {
        const mark = create("span", "social-mark", ({Instagram:"◎",TikTok:"♪",Discord:"◈",YouTube:"▶"})[item.label] || "↗");
        link.prepend(mark);
        socials.append(link);
      }
    });
    if (socials.childElementCount) details.append(socials);
    card.append(photo, details);
    target.append(card);
  };

  const adminsGrid = $("#adminsGrid");
  const supportGrid = $("#supportCrewGrid");
  const crewAdmins = data.admins.filter(admin => admin.section !== "SUPPORT CREW");
  const supportAdmins = data.admins.filter(admin => admin.section === "SUPPORT CREW");
  crewAdmins.forEach((admin, index) => renderAdminCard(admin, index, adminsGrid));
  supportAdmins.forEach((admin, index) => renderAdminCard(admin, index + crewAdmins.length, supportGrid));

  const logoHistoryGrid = $("#logoHistoryGrid");
  (data.logoHistory || []).forEach((item, index) => {
    const card = create("article", "logo-history-card reveal");
    const media = create("div", "logo-history-media");
    const img = create("img", "", "");
    img.src = item.photo;
    img.alt = `${item.name} — F4NTASTIC`;
    img.loading = "lazy";
    media.append(img);
    const details = create("div", "logo-history-details");
    details.append(create("span", "logo-period", item.period));
    details.append(create("h3", "", item.name));
    details.append(create("p", "", item.description));
    card.append(media, details);
    logoHistoryGrid.append(card);
  });

  const tickerTrack = $("#tickerTrack");
  if (data.marquee && data.marquee.length) {
    tickerTrack.replaceChildren();
    const addMarqueeItems = () => data.marquee.forEach((item, index) => {
      tickerTrack.append(create("span", "", item));
      if (index < data.marquee.length - 1) tickerTrack.append(create("b", "", "✦"));
    });
    addMarqueeItems();
    tickerTrack.insertAdjacentHTML("beforeend", '<b aria-hidden="true">✦</b>');
    addMarqueeItems();
  }

  // Statistik dihitung dari nol saat bloknya mulai terlihat.
  const statItems = data.communityStats ? [
    [$("#statMembers"), data.communityStats.activeMembers],
    [$("#statDivisions"), data.communityStats.divisions],
    [$("#statAchievements"), data.communityStats.achievements],
  ] : [];

  const animateStats = () => {
    if (!statItems.length || animateStats.started) return;
    animateStats.started = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = 3200;

    statItems.forEach(([element, value], index) => {
      if (!element) return;
      const target = Math.max(0, Number(value) || 0);
      if (reducedMotion) {
        element.textContent = target.toLocaleString("id-ID");
        return;
      }

      const start = performance.now();
      const tick = now => {
        const progress = Math.min((now - start - index * 260) / duration, 1);
        if (progress < 0) {
          window.requestAnimationFrame(tick);
          return;
        }
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = Math.round(target * eased).toLocaleString("id-ID");
        if (progress < 1) window.requestAnimationFrame(tick);
      };
      element.textContent = "0";
      window.requestAnimationFrame(tick);
    });
  };

  const statsSection = $(".community-stats");
  if (statsSection && "IntersectionObserver" in window) {
    const statsObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        animateStats();
        statsObserver.disconnect();
      }
    }, { threshold: 0.3 });
    statsObserver.observe(statsSection);
  } else {
    animateStats();
  }

  const officialSocials = $("#officialSocials");
  const footerSocials = $("#footerSocials");
  data.officialSocials.forEach(item => {
    const link = socialLink(item, false);
    if (link) officialSocials.append(link);
    const footerLink = socialLink(item, true);
    if (footerLink) {
      footerLink.classList.add("footer-social-chip");
      footerLink.prepend(create("span", "social-mark", ({Instagram:"◎",TikTok:"♪",Discord:"◈",YouTube:"▶"})[item.label] || "↗"));
      footerSocials.append(footerLink);
    }
  });

  if (data.squad.logo) {
    const emblem = $("#heroEmblem");
    emblem.style.backgroundImage = `url("${data.squad.logo.replace(/["\\]/g, "")}")`;
    emblem.classList.add("has-logo");
  }

  // Navigasi seluler.
  const menuToggle = $("#menuToggle");
  const mainNav = $("#mainNav");
  menuToggle.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!open));
    mainNav.classList.toggle("is-open", !open);
    document.body.classList.toggle("menu-open", !open);
  });
  mainNav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    menuToggle.setAttribute("aria-expanded", "false");
    mainNav.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  }));

  // Modal persyaratan join team.
  const joinModal = $("#joinModal");
  const joinOpenButton = $("#joinOpenButton");
  const joinRequirements = $("#joinRequirements");
  const joinAgreeButton = $("#joinAgreeButton");
  const joinReadStatus = $("#joinReadStatus");
  let previousFocus;
  const closeJoinModal = () => {
    if (!joinModal) return;
    joinModal.hidden = true;
    document.body.classList.remove("menu-open");
    if (previousFocus) previousFocus.focus();
  };
  const markRequirementsRead = () => {
    if (!joinRequirements || !joinAgreeButton) return;
    const reachedEnd = joinRequirements.scrollTop + joinRequirements.clientHeight >= joinRequirements.scrollHeight - 8;
    if (reachedEnd) {
      joinAgreeButton.disabled = false;
      if (joinReadStatus) joinReadStatus.textContent = "Persyaratan sudah dibaca. Kamu bisa melanjutkan.";
    }
  };
  if (joinModal && joinOpenButton && joinRequirements && joinAgreeButton) {
    joinOpenButton.addEventListener("click", () => {
      previousFocus = document.activeElement;
      joinModal.hidden = false;
      joinRequirements.scrollTop = 0;
      joinAgreeButton.disabled = true;
      if (joinReadStatus) joinReadStatus.textContent = "Scroll sampai akhir persyaratan untuk mengaktifkan tombol setuju.";
      document.body.classList.add("menu-open");
      window.setTimeout(() => {
        markRequirementsRead();
        joinRequirements.focus();
      }, 0);
    });
    joinRequirements.addEventListener("scroll", markRequirementsRead, { passive: true });
    joinModal.querySelectorAll("[data-join-close]").forEach(button => button.addEventListener("click", closeJoinModal));
    joinAgreeButton.addEventListener("click", () => {
      if (joinAgreeButton.disabled) return;
      closeJoinModal();
      window.location.href = "join-form.html";
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !joinModal.hidden) closeJoinModal();
    });
  }

  // Tandai menu yang sesuai dengan bagian halaman yang sedang terlihat.
  const navLinks = [...mainNav.querySelectorAll('a[href^="#"]')];
  const navSections = navLinks
    .map(link => {
      const target = link.getAttribute("href");
      const section = document.querySelector(target);
      return { link, section, id: target.slice(1) };
    })
    .filter(item => item.section);
  const setActiveNav = id => navLinks.forEach(link => {
    const active = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  setActiveNav("home");
  const updateActiveNav = () => {
    const marker = window.scrollY + Math.min(window.innerHeight * .34, 260);
    let current = navSections[0]?.id || "home";
    navSections.forEach(({ section, id }) => {
      if (section.getBoundingClientRect().top + window.scrollY <= marker) current = id;
    });
    setActiveNav(current);
  };
  window.addEventListener("scroll", updateActiveNav, { passive: true });
  window.addEventListener("resize", updateActiveNav);
  updateActiveNav();

  // Animasi masuk saat bagian halaman mulai terlihat.
  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add("is-visible"));
  }
})();
