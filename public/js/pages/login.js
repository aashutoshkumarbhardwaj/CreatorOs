const googleLogin = document.querySelector('.google-login');
const emailForm = document.querySelector('#email-login-form');
const contributorForm = document.querySelector('#contributor-login-form');

let emailLoading = false;
let contributorLoading = false;

googleLogin?.addEventListener('click', function () {
this.setAttribute('aria-busy', 'true');

```
const span = this.querySelector('span');

if (span) {
    span.textContent = this.dataset.loadingText || 'Signing in...';
}

this.disabled = true;
```

});

emailForm?.addEventListener('submit', function () {
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
```

});

contributorForm?.addEventListener('submit', async function (event) {
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
```

});
