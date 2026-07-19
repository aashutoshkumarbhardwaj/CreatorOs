import re
import os

pages = {
    'dashboard.ejs': 'dashboard.css',
    'analytics-dashboard.ejs': 'analytics.css',
    'creator-crm.ejs': 'crm.css',
    'dm-automation.ejs': 'dm-automation.css'
}

for page, css_file in pages.items():
    filepath = os.path.join('view', page)
    with open(filepath, 'r') as f:
        content = f.read()
    
    # 1. Extract CSS
    style_match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
    if style_match:
        css_content = style_match.group(1)
        with open(os.path.join('public', 'css', css_file), 'w') as f:
            f.write(css_content)
    
    # 2. Extract Body class and attributes
    body_match = re.search(r'<body(.*?)>', content, re.DOTALL)
    body_attrs = body_match.group(1).strip() if body_match else ""
    
    bodyClass = ""
    bodyAttributes = ""
    if 'class="' in body_attrs:
        class_match = re.search(r'class="([^"]*)"', body_attrs)
        if class_match:
            bodyClass = class_match.group(1)
            body_attrs = body_attrs.replace(class_match.group(0), '')
    bodyAttributes = body_attrs.strip()
    
    # 3. Determine activeNav and title
    active_nav = page.replace('.ejs', '').replace('-dashboard', '')
    title_match = re.search(r'title:\s*\'([^\']+)\'', content)
    title = title_match.group(1) if title_match else 'CreatorOS'
    
    # 4. Generate header string
    # Prepare bodyAttrs string safely (escape quotes if necessary)
    # Actually, if we just pass bodyAttributes literally...
    # In my-links.ejs it was complex. Let's just pass whatever was there.
    # But wait, bodyAttributes in EJS needs to be safely injected. Let's just pass the exact string.
    body_attr_str = f"bodyAttributes: `{bodyAttributes}`," if bodyAttributes else ""
    body_class_str = f"bodyClass: '{bodyClass}'," if bodyClass else ""
    
    header_str = f"""<%- include('partials/layout/header', {{
    activeNav: '{active_nav}',
    title: '{title}',
    {body_class_str}
    {body_attr_str}
    extraHead: '<link rel="stylesheet" href="/css/{css_file}">'
}}) %>"""

    # 5. Find start of main content (right after topbar include)
    # Using regex to find the end of topbar include
    topbar_match = re.search(r'<%- include\([\'"](?:\./)?partials/(?:layout/)?_?topbar.*?\) %>', content)
    if not topbar_match:
        topbar_match = re.search(r'<%- include\([^)]*?topbar[^)]*\) %>', content)
    
    if topbar_match:
        start_idx = topbar_match.end()
    else:
        # Fallback if topbar not found, find <main>
        main_match = re.search(r'<main[^>]*>', content)
        start_idx = main_match.end() if main_match else 0
        
    # 6. Find end of the layout 
    # Usually it's </main> </div> script tags </body>
    # Let's find the last </script> or </main>
    # The user wants footer.ejs to replace the script include.
    # The original files have `<%- include('./partials/_scripts') %>` or something similar, and `</body></html>`
    
    # We will slice from start_idx to the end, then replace the bottom boilerplate with footer include.
    main_content_and_bottom = content[start_idx:]
    
    # Remove the `</div>` that closes dashboard-layout
    # Remove the `</main>` if it exists, footer.ejs handles it.
    # But wait! If there are modals, they are placed AFTER </main>.
    # If we remove </main> and </div>, and put footer.ejs at the end, the modals will be inside <main>. That is perfectly fine!
    
    # Let's just remove </main> and the </div> for dashboard-layout
    # and replace `</body></html>` and `partials/scripts` with footer include.
    
    # Remove </main>
    new_content_tail = re.sub(r'</main>\s*</div>', '', main_content_and_bottom)
    new_content_tail = re.sub(r'</main>', '', new_content_tail)
    
    # Remove old scripts include
    new_content_tail = re.sub(r'<%- include\([\'"](?:\./)?partials/(?:layout/)?_?scripts.*?\) %>', '', new_content_tail)
    
    # Remove body/html tags
    new_content_tail = re.sub(r'</body>\s*</html>', '', new_content_tail)
    
    # Append footer
    new_content_tail += "\\n<%- include('partials/layout/footer') %>\\n"
    
    final_content = header_str + new_content_tail
    
    with open(filepath, 'w') as f:
        f.write(final_content)

print("Processing complete.")
