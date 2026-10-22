(() => {
  const usersKey = "f4ntastic-users";
  const getUsers = () => JSON.parse(localStorage.getItem(usersKey) || "[]");
  const setMessage = (el, text, ok = false) => { el.textContent = text; el.className = `auth-message ${ok ? "is-success" : "is-error"}`; };
  const register = document.querySelector("#registerForm");
  if (register) register.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.querySelector("#registerName").value.trim();
    const email = document.querySelector("#registerEmail").value.trim().toLowerCase();
    const username = document.querySelector("#registerUsername").value.trim().toLowerCase();
    const password = document.querySelector("#registerPassword").value;
    const message = document.querySelector("#registerMessage");
    if (!name || !email || !username || password.length < 6) return setMessage(message, "Lengkapi data. Password minimal 6 karakter.");
    const users = getUsers();
    if (users.some(user => user.email === email || user.username === username)) return setMessage(message, "Email atau username sudah digunakan.");
    users.push({ name, email, username, password, createdAt: new Date().toISOString() });
    localStorage.setItem(usersKey, JSON.stringify(users));
    setMessage(message, "Akun berhasil dibuat. Mengarahkan ke halaman login...", true);
    setTimeout(() => { location.href = "login.html"; }, 900);
  });
  const login = document.querySelector("#loginForm");
  if (login) login.addEventListener("submit", (event) => {
    event.preventDefault();
    const identity = document.querySelector("#loginIdentity").value.trim().toLowerCase();
    const password = document.querySelector("#loginPassword").value;
    const message = document.querySelector("#loginMessage");
    const user = getUsers().find(item => (item.email === identity || item.username === identity) && item.password === password);
    if (!user) return setMessage(message, "Email/username atau password belum sesuai.");
    sessionStorage.setItem("f4ntastic-user", JSON.stringify({ name: user.name, username: user.username, email: user.email }));
    setMessage(message, `Selamat datang, ${user.name}. Mengarahkan...`, true);
    setTimeout(() => { location.href = "index.html"; }, 650);
  });
})();
