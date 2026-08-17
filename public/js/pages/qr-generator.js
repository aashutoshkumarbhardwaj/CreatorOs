(function () {
    const root = document.querySelector('.qr-page');
    if (!root) return;

    const csrfToken = root.dataset.csrf;
    let qrCodes = [];
    try {
        qrCodes = JSON.parse(decodeURIComponent(root.dataset.qrCodes || '%5B%5D'));
    } catch (_) {
        qrCodes = [];
    }

    const els = {
        targetUrl: document.getElementById('qrTargetUrl'),
        textContent: document.getElementById('qrTextContent'),
        label: document.getElementById('qrLabel'),
        campaignName: document.getElementById('qrCampaignName'),
        dynamic: document.getElementById('qrDynamic'),
        foreground: document.getElementById('qrForeground'),
        foregroundText: document.getElementById('qrForegroundText'),
        background: document.getElementById('qrBackground'),
        backgroundText: document.getElementById('qrBackgroundText'),
        logoUrl: document.getElementById('qrLogoUrl'),
        preview: document.getElementById('qrPreview'),
        saveBtn: document.getElementById('saveQrBtn'),
        saveStatus: document.getElementById('qrSaveStatus'),
        batchUrls: document.getElementById('qrBatchUrls'),
        batchBtn: document.getElementById('qrBatchBtn'),
        batchStatus: document.getElementById('qrBatchStatus'),
        library: document.getElementById('qrLibrary'),
        libraryCount: document.getElementById('libraryCount'),
        telemetryScans24h: document.getElementById('telemetryScans24h'),
        telemetryConversionRate: document.getElementById('telemetryConversionRate'),
        telemetryActiveLinks: document.getElementById('telemetryActiveLinks'),
        telemetryScanFeed: document.getElementById('telemetryScanFeed'),
        svgBtn: document.getElementById('downloadSvgBtn'),
        pngBtn: document.getElementById('downloadPngBtn'),
        pdfBtn: document.getElementById('downloadPdfBtn'),
    };

    let selectedPreset = 'A';
    let selectedMode = 'url';
    let latestQr = qrCodes[0] || null;
    let previewQr = null;
    let telemetryPollHandle = null;

    function isHex(value) {
        return /^#[0-9A-Fa-f]{6}$/.test(value);
    }

    function syncColor(source, target) {
        if (!source || !target) return;
        const value = source.value.toUpperCase();
        if (isHex(value)) target.value = value;
    }

    function dotTypeForPreset(preset) {
        return {
            A: 'square',
            B: 'dots',
            C: 'rounded',
            D: 'classy',
            E: 'extra-rounded',
        }[preset] || 'square';
    }

    function getDesign() {
        return {
            foregroundColor: els.foreground.value,
            backgroundColor: els.background.value,
            patternPreset: selectedPreset,
            logoUrl: els.logoUrl.value.trim(),
        };
    }

    function getEncodedPreviewUrl() {
        if (selectedMode === 'text') {
            return els.textContent.value.trim() || 'Text QR preview';
        }
        return els.targetUrl.value.trim() || 'https://your-link.com';
    }

    function updateMode(mode) {
        selectedMode = mode === 'text' ? 'text' : 'url';
        document.querySelectorAll('.mode-btn[data-mode]').forEach((button) => {
            const isActive = button.dataset.mode === selectedMode;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        document.querySelectorAll('[data-content-panel]').forEach((panel) => {
            panel.classList.toggle('is-hidden', panel.dataset.contentPanel !== selectedMode);
        });

        els.dynamic.disabled = selectedMode === 'text';
        if (selectedMode === 'text') els.dynamic.checked = false;
        updatePreview();
    }

    function updatePreview(encodedOverride) {
        if (!window.QRCodeStyling || !els.preview) return;

        const design = getDesign();
        const config = {
            width: 360,
            height: 360,
            type: 'svg',
            data: encodedOverride || getEncodedPreviewUrl(),
            image: design.logoUrl || undefined,
            dotsOptions: {
                color: design.foregroundColor,
                type: dotTypeForPreset(design.patternPreset),
            },
            backgroundOptions: {
                color: design.backgroundColor,
            },
            cornersSquareOptions: {
                type: 'square',
                color: design.foregroundColor,
            },
            cornersDotOptions: {
                type: 'square',
                color: design.foregroundColor,
            },
            imageOptions: {
                crossOrigin: 'anonymous',
                margin: 8,
                imageSize: 0.22,
            },
            qrOptions: {
                errorCorrectionLevel: design.logoUrl ? 'H' : 'M',
            },
        };

        if (!previewQr) {
            previewQr = new window.QRCodeStyling(config);
            els.preview.innerHTML = '';
            previewQr.append(els.preview);
        } else {
            previewQr.update(config);
        }
    }

    function setStatus(node, message, tone) {
        if (!node) return;
        node.textContent = message || '';
        node.dataset.tone = tone || '';
    }

    function setLatestQr(qr) {
        latestQr = qr;
        [els.svgBtn, els.pngBtn, els.pdfBtn].forEach((btn) => { if (btn) btn.disabled = !qr; });
    }

    function renderLibrary() {
        if (!els.library) return;
        els.libraryCount.textContent = `${qrCodes.length} saved`;

        if (!qrCodes.length) {
            els.library.innerHTML = '<div class="library-empty">No saved QR codes yet.</div>';
            return;
        }

        els.library.innerHTML = qrCodes.map((qr) => `
            <article class="library-item" data-id="${qr.id}">
                <div class="library-main">
                    <strong>${escapeHtml(qr.label || qr.shortId || 'Untitled QR')}</strong>
                    <span>${escapeHtml(qr.shortUrl || qr.encodedUrl || qr.targetUrl)}</span>
                    <small>${escapeHtml(qr.inputType || 'url')}${qr.campaignName ? ` - ${escapeHtml(qr.campaignName)}` : ''} - ${qr.totalScans || 0} scans</small>
                </div>
                <div class="library-actions">
                    <a href="${qr.exportLinks.svg}">SVG</a>
                    <a href="${qr.exportLinks.png}">PNG</a>
                    <a href="${qr.exportLinks.pdf}">PDF</a>
                    <button type="button" class="delete-qr">Delete</button>
                </div>
            </article>
        `).join('');
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[char]));
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }

    function renderTelemetry(telemetry) {
        if (!telemetry) return;
        if (els.telemetryScans24h) els.telemetryScans24h.textContent = String(telemetry.scans24h ?? 0);
        if (els.telemetryConversionRate) els.telemetryConversionRate.textContent = telemetry.conversionRateLabel || 'N/A';
        if (els.telemetryActiveLinks) els.telemetryActiveLinks.textContent = String(telemetry.activeLinks ?? 0);

        if (!els.telemetryScanFeed) return;
        const scans = Array.isArray(telemetry.recentScans) ? telemetry.recentScans.slice(0, 8) : [];
        if (!scans.length) {
            els.telemetryScanFeed.innerHTML = `
                <p>Live scan feed</p>
                <div class="scan-row empty"><span>No scans yet</span><span>Unknown</span><span>Waiting</span></div>
            `;
            return;
        }

        els.telemetryScanFeed.innerHTML = `
            <p>Live scan feed</p>
            ${scans.map((scan) => `
                <div class="scan-row">
                    <span>${escapeHtml(scan.linkId || '—')}</span>
                    <span>${escapeHtml(scan.location || 'Unknown')}</span>
                    <time datetime="${escapeAttr(scan.timestamp)}">${escapeHtml(new Date(scan.timestamp).toLocaleString())}</time>
                </div>
            `).join('')}
        `;
    }

    async function refreshTelemetry() {
        try {
            const response = await fetch('/services/qr-code-generator/telemetry', {
                headers: { 'Accept': 'application/json' },
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) return;
            renderTelemetry(payload.telemetry);
        } catch (_) {
            // Keep the last snapshot on transient failures.
        }
    }

    async function saveQr() {
        setStatus(els.saveStatus, 'Saving QR code...', 'muted');
        els.saveBtn.disabled = true;

        try {
            const response = await fetch('/services/qr-code-generator/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({
                    targetUrl: els.targetUrl.value.trim(),
                    text: els.textContent.value.trim(),
                    inputType: selectedMode,
                    label: els.label.value.trim(),
                    campaignName: els.campaignName.value.trim(),
                    isDynamic: els.dynamic.checked,
                    autoShortLink: els.dynamic.checked,
                    design: getDesign(),
                }),
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message || 'Unable to save QR code');

            qrCodes.unshift(payload.qrCode);
            setLatestQr(payload.qrCode);
            renderLibrary();
            if (payload.qrCode && payload.qrCode.encodedUrl) updatePreview(payload.qrCode.encodedUrl);
            setStatus(els.saveStatus, 'Saved. Export links are ready.', 'success');
        } catch (err) {
            setStatus(els.saveStatus, err.message, 'error');
        } finally {
            els.saveBtn.disabled = false;
        }
    }

    async function batchCreate() {
        setStatus(els.batchStatus, 'Generating ZIP...', 'muted');
        els.batchBtn.disabled = true;

        try {
            const response = await fetch('/services/qr-code-generator/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/zip',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({
                    urls: els.batchUrls.value,
                    isDynamic: els.dynamic.checked,
                    labelPrefix: els.label.value.trim() || 'QR',
                    campaignName: els.campaignName.value.trim(),
                    design: getDesign(),
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Batch generation failed');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'qr-batch.zip';
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            const created = response.headers.get('X-QR-Created-Count') || '0';
            const failed = response.headers.get('X-QR-Failed-Count') || '0';
            setStatus(els.batchStatus, `ZIP ready. Created ${created}; skipped ${failed}. Refresh to see the new library items.`, failed === '0' ? 'success' : 'muted');
        } catch (err) {
            setStatus(els.batchStatus, err.message, 'error');
        } finally {
            els.batchBtn.disabled = false;
        }
    }

    async function deleteQr(id) {
        const response = await fetch(`/services/qr-code-generator/${id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'X-CSRF-Token': csrfToken,
            },
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || 'Delete failed');
        qrCodes = qrCodes.filter((qr) => qr.id !== id);
        if (latestQr && latestQr.id === id) setLatestQr(qrCodes[0] || null);
        renderLibrary();
    }

    document.querySelectorAll('.preset-btn[data-preset]').forEach((button) => {
        button.addEventListener('click', () => {
            selectedPreset = button.dataset.preset;
            document.querySelectorAll('.preset-btn[data-preset]').forEach((btn) => {
                btn.classList.toggle('active', btn === button);
                btn.setAttribute('aria-pressed', btn === button ? 'true' : 'false');
            });
            updatePreview();
        });
    });

    document.querySelectorAll('.mode-btn[data-mode]').forEach((button) => {
        button.addEventListener('click', () => updateMode(button.dataset.mode));
    });
    [els.targetUrl, els.textContent, els.logoUrl].forEach((input) => input.addEventListener('input', () => updatePreview()));
    els.dynamic.addEventListener('change', () => updatePreview());
    els.foreground.addEventListener('input', () => { syncColor(els.foreground, els.foregroundText); updatePreview(); });
    els.background.addEventListener('input', () => { syncColor(els.background, els.backgroundText); updatePreview(); });
    els.foregroundText.addEventListener('input', () => { syncColor(els.foregroundText, els.foreground); updatePreview(); });
    els.backgroundText.addEventListener('input', () => { syncColor(els.backgroundText, els.background); updatePreview(); });
    els.saveBtn.addEventListener('click', saveQr);
    els.batchBtn.addEventListener('click', batchCreate);

    [['svg', els.svgBtn], ['png', els.pngBtn], ['pdf', els.pdfBtn]].forEach(([format, button]) => {
        button.addEventListener('click', () => {
            if (latestQr) window.location.href = latestQr.exportLinks[format];
        });
    });

    els.library.addEventListener('click', async (event) => {
        if (!event.target.classList.contains('delete-qr')) return;
        const item = event.target.closest('.library-item');
        try {
            await deleteQr(item.dataset.id);
        } catch (err) {
            alert(err.message);
        }
    });

    renderLibrary();
    setLatestQr(latestQr);
    updateMode('url');
    renderTelemetry({
        scans24h: 0,
        conversionRateLabel: 'N/A',
        activeLinks: qrCodes.filter((qr) => qr.isDynamic && qr.shortId).length,
        recentScans: [],
    });
    refreshTelemetry();
    telemetryPollHandle = window.setInterval(refreshTelemetry, 10000);

    window.addEventListener('beforeunload', () => {
        if (telemetryPollHandle) window.clearInterval(telemetryPollHandle);
    });
    window.addEventListener('load', () => updatePreview());
})();
