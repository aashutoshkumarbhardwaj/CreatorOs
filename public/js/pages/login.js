const googleLogin = document.querySelector('.google-login');
        const emailForm = document.querySelector('#email-login-form');
        const contributorForm = document.querySelector('#contributor-login-form');

        googleLogin?.addEventListener('click', function () {
            this.setAttribute('aria-busy', 'true');
            this.querySelector('span').textContent = this.dataset.loadingText;
        });

        emailForm?.addEventListener('submit', function () {
            const submitButton = this.querySelector('button[type="submit"]');

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = submitButton.dataset.loadingText;
            }
        });

        contributorForm?.addEventListener('submit', async function (event) {
            event.preventDefault();

            const submitButton = this.querySelector('button[type="submit"]');

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = submitButton.dataset.loadingText;
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
                    submitButton.textContent = 'Continue as Contributor';
                }
            }
        });