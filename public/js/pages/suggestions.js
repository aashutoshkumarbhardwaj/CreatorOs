// Sidebar toggle
    var layout = document.getElementById('dashboardLayout');
    var toggle = document.getElementById('sidebarToggle');
    if (localStorage.getItem('creatorosSidebarCollapsed') === 'true') {
      layout.classList.add('sidebar-collapsed');
      toggle.setAttribute('aria-expanded', 'false');
    }
    toggle.addEventListener('click', function() {
      var collapsed = layout.classList.toggle('sidebar-collapsed');
      toggle.setAttribute('aria-expanded', String(!collapsed));
      localStorage.setItem('creatorosSidebarCollapsed', String(collapsed));
    });

    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        navigator.clipboard.writeText(btn.getAttribute('data-text')).then(function() {
        .catch(err => console.error(err))