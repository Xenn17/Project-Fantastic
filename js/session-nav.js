(() => {
  const raw = sessionStorage.getItem('f4ntastic-user');
  document.querySelectorAll('.nav-login').forEach(link => {
    if (!raw) return;
    try {
      const user = JSON.parse(raw);
      const label = user.username || user.name || user.email?.split('@')[0] || 'Profil';
      const needsProfile = !user.profileComplete;
      link.href = 'profile.html';
      link.innerHTML = '<span class="nav-login-dot"></span> ' + label + (needsProfile ? ' <b class="profile-alert" title="Lengkapi profil">*</b>' : '');
      link.setAttribute('aria-label', 'Buka profil ' + label);
    } catch {}
  });
})();
