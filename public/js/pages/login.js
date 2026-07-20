const googleLogin = document.querySelector(".google-login");
const emailForm = document.querySelector("#email-login-form");
const contributorForm = document.querySelector("#contributor-login-form");

let emailLoading = false;
let contributorLoading = false;

googleLogin?.addEventListener("click", function () {
  this.setAttribute("aria-busy", "true");

  ```
const span = this.querySelector('span');

if (span) {
    span.textContent = this.dataset.loadingText || 'Signing in...';
}

this.disabled = true;
```;
});

emailForm?.addEventListener("submit", function () {
  if (emailLoading) return false;

  ```
emailLoading = true;

const submitButton = this.querySelector('button[type="submit"]');

if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');

    submitButton.dataset.originalText = submitButton.textContent;

    submitButton.textContent =
        submitButton.dataset.loadingText || 'Signing in...';
}
```;
});

contributorForm?.addEventListener("submit", async function (event) {
  event.preventDefault();

  ```
if (contributorLoading) return;

contributorLoading = true;

const submitButton = this.querySelector('button[type="submit"]');

const originalText =
    submitButton?.textContent || 'Continue as Contributor';

if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');

    submitButton.textContent =
        submitButton.dataset.loadingText || 'Signing in...';
}

try {
    const response = await fetch('/api/auth/contributor-login', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
        },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.message || 'Contributor login failed');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    window.location.href = '/dashboard';
} catch (error) {
    console.error(error);

    if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute('aria-busy');
        submitButton.textContent = originalText;
    }
} finally {
    contributorLoading = false;
}
```;
});

// Show/Hide Password Toggle
const togglePasswordBtn = document.querySelector("#toggle-password");
const passwordInput = document.querySelector("#login-password");

togglePasswordBtn?.addEventListener("click", function () {
  const isPassword = passwordInput.getAttribute("type") === "password";
  passwordInput.setAttribute("type", isPassword ? "text" : "password");

  if (isPassword) {
    this.innerHTML = `
            <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
        `;
    this.setAttribute("aria-label", "Hide password");
  } else {
    this.innerHTML = `
            <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
    this.setAttribute("aria-label", "Show password");
  }
});
