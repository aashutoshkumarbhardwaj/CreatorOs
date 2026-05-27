const dashboardLayout = document.getElementById('dashboardLayout');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebarState = localStorage.getItem('creatorosSidebarCollapsed');

        if (sidebarState === 'true') {
            dashboardLayout.classList.add('sidebar-collapsed');
            sidebarToggle.setAttribute('aria-expanded', 'false');
        }

        sidebarToggle.addEventListener('click', () => {
            const isCollapsed = dashboardLayout.classList.toggle('sidebar-collapsed');
            sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
            localStorage.setItem('creatorosSidebarCollapsed', String(isCollapsed));
        });
        
const toggleBtn = document.getElementById("theme-toggle");

toggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");

    if(document.body.classList.contains("light-mode")){
        localStorage.setItem("theme", "light");
        toggleBtn.innerText = "🌙";
    } else {
        localStorage.setItem("theme", "dark");
        toggleBtn.innerText = "☀️";
    }
});

window.onload = () => {
    const savedTheme = localStorage.getItem("theme");

    if(savedTheme === "light"){
        document.body.classList.add("light-mode");
        toggleBtn.innerText = "🌙";
    } else {
        toggleBtn.innerText = "☀️";
    }
}