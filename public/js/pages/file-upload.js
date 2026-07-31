const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const uploadIcon = document.getElementById('upload-icon');
        const dropText = document.getElementById('drop-text');
        const dropSub = document.getElementById('drop-sub');
        const fileInfo = document.getElementById('file-info');
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        const removeBtn = document.getElementById('remove-file');
        const uploadBtn = document.getElementById('upload-btn');
        const progressArea = document.getElementById('progress-area');
        const progressBar = document.getElementById('progress-bar');
        const progressPct = document.getElementById('progress-pct');
        const progressLabel = document.getElementById('progress-label');
        const statusEl = document.getElementById('status');
        let selectedFiles = [];

        // Firefox fix: preventDefault is REQUIRED on dragover
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.backgroundColor = 'var(--accent-yellow)';
            dropZone.style.borderColor = 'var(--text)';
        });

        dropZone.addEventListener('dragenter', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.backgroundColor = 'var(--accent-yellow)';
            dropZone.style.borderColor = 'var(--text)';
        });

        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.backgroundColor = 'var(--bg-secondary)';
            dropZone.style.borderColor = 'var(--border)';
        });

        // Firefox fix: preventDefault is REQUIRED on drop
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.backgroundColor = 'var(--bg-secondary)';
            dropZone.style.borderColor = 'var(--border)';

            var files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFiles(files);
            }
        });

        dropZone.addEventListener('click', function() {
            if (!selectedFile) fileInput.click();
        });

        fileInput.setAttribute('multiple', 'true');

        fileInput.addEventListener('change', function() {
            if (this.files.length > 0) handleFiles(this.files);
        });

        removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            clearSelection();
        });

        uploadBtn.addEventListener('click', function() {
            if (!selectedFiles.length) return;
            selectedFiles.forEach(uploadFile);
        });

        function handleFiles(fileList) {
            selectedFiles = Array.from(fileList);
            fileName.textContent = selectedFiles.map(function(f) { return f.name; }).join(', ');
            fileSize.textContent = formatSize(selectedFiles.reduce(function(sum, f) { return sum + f.size; }, 0));
            fileInfo.style.display = 'flex';
            uploadBtn.disabled = false;
            uploadBtn.className = 'primary-action-btn';
            uploadBtn.style.width = '100%';
            uploadBtn.style.justifyContent = 'center';
            uploadBtn.style.fontSize = '1.1rem';
            uploadBtn.style.padding = '1rem';
            uploadBtn.style.opacity = '1';
            uploadBtn.style.cursor = 'pointer';
            uploadBtn.textContent = 'Upload ' + selectedFiles.length + ' file(s)';
            dropText.textContent = selectedFiles.length + ' file(s) selected';
            dropSub.textContent = 'click to choose different files';
            uploadIcon.textContent = '✅';
        }

        function clearSelection() {
            selectedFiles = [];
            fileInfo.style.display = 'none';
            uploadBtn.disabled = true;
            uploadBtn.className = 'primary-action-btn';
            uploadBtn.style.width = '100%';
            uploadBtn.style.justifyContent = 'center';
            uploadBtn.style.fontSize = '1.1rem';
            uploadBtn.style.padding = '1rem';
            uploadBtn.style.opacity = '0.5';
            uploadBtn.style.cursor = 'not-allowed';
            uploadBtn.textContent = 'Select files to upload';
            fileInput.value = '';
            dropText.textContent = 'Drag & drop files here';
            dropSub.textContent = 'or click to browse files';
            uploadIcon.textContent = '📁';
            progressArea.style.display = 'none';
            statusEl.style.display = 'none';
        }

        function uploadFile(file) {
            var formData = new FormData();
            formData.append('file', file);

            var xhr = new XMLHttpRequest();

            xhr.upload.onprogress = function(e) {
                progressArea.style.display = 'block';
                if (e.lengthComputable) {
                    var pct = Math.round((e.loaded / e.total) * 100);
                    progressBar.style.width = pct + '%';
                    progressPct.textContent = pct + '%';
                }
            };

            xhr.onload = function() {
                progressBar.style.width = '100%';
                progressPct.textContent = '100%';
                progressLabel.textContent = 'Complete!';

                if (xhr.status >= 200 && xhr.status < 300) {
                    var data = JSON.parse(xhr.responseText);
                    statusEl.className = 'message-box message-success';
                    statusEl.innerHTML = '<strong>Upload successful!</strong><br>File: ' + data.filename + '<br>Size: ' + formatSize(data.size);
                    statusEl.style.display = 'block';
                } else {
                    statusEl.className = 'message-box message-error';
                    statusEl.textContent = 'Upload failed. Please try again.';
                    statusEl.style.display = 'block';
                }
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload another file';
            };

            xhr.onerror = function() {
                progressLabel.textContent = 'Error';
                statusEl.className = 'message-box message-error';
                statusEl.textContent = 'Network error. Please check your connection.';
                statusEl.style.display = 'block';
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Try Again';
            };

            xhr.open('POST', '/services/file-upload/upload');
            xhr.send(formData);

            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';
        }

        function formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1048576).toFixed(1) + ' MB';
        }
   

