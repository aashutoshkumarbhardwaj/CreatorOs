gsap.registerPlugin(ScrollTrigger);

        // --- HERO ANIMATIONS ---
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        tl.from(".logo", { opacity: 0, y: -30, duration: 0.8, delay: 0.2 });
        tl.from(".nav-links > a", { opacity: 0, y: -30, duration: 0.5, stagger: 0.2 }, "-=0.5");
        tl.from(".hero-title", { opacity: 0, y: 50, duration: 1 }, "-=0.6");
        tl.from(".hero-subtitle", { opacity: 0, y: 40, duration: 0.8 }, "-=0.7");
        tl.from(".hero-form", { opacity: 0, y: 30, duration: 0.8 }, "-=0.6");

        // --- SCROLL-TRIGGERED ANIMATIONS ---

        // Animate Section Titles on scroll
        gsap.utils.toArray('.section-title').forEach(title => {
            gsap.from(title, {
                opacity: 0,
                y: 50,
                duration: 0.8,
                scrollTrigger: {
                    trigger: title,
                    start: "top 85%",
                    toggleActions: "play none none none"
                }
            });
        });

        gsap.utils.toArray('.section-subtitle').forEach(subtitle => {
            gsap.from(subtitle, {
                opacity: 0,
                y: 40,
                duration: 0.8,
                delay: 0.2,
                scrollTrigger: {
                    trigger: subtitle,
                    start: "top 90%",
                    toggleActions: "play none none none"
                }
            });
        });

        // Animate Feature Cards
        gsap.utils.toArray('.feature-card').forEach((card, i) => {
            gsap.from(card, {
                opacity: 0,
                scale: 0.9,
                y: 60,
                duration: 0.6,
                delay: i * 0.15,
                scrollTrigger: {
                    trigger: card,
                    start: "top 85%",
                    toggleActions: "play none none none"
                }
            });
        });

        // Animate "How it works" steps
        gsap.utils.toArray('.step').forEach((step, i) => {
            gsap.from(step, {
                opacity: 0,
                y: 50,
                duration: 0.5,
                delay: i * 0.2,
                scrollTrigger: {
                    trigger: ".step",
                    start: "top 85%",
                    toggleActions: "play none none none"
                }
            });
        });