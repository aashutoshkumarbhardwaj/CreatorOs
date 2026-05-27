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
          var orig = btn.textContent;
          btn.textContent = '✓ Copied!';
          btn.style.color = '#22c55e';
          btn.style.borderColor = '#22c55e';
          setTimeout(function() {
            btn.textContent = orig;
            btn.style.color = '';
            btn.style.borderColor = '';
          }, 2000);
        });
      });
    });

    // Clickable hashtag tags
    document.querySelectorAll('.tag').forEach(function(tag) {
      tag.addEventListener('click', function() {
        navigator.clipboard.writeText(tag.getAttribute('data-text')).then(function() {
          var orig = tag.textContent;
          tag.textContent = '✓ copied';
          setTimeout(function() { tag.textContent = orig; }, 1500);
        });
      });
    });