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
        let selectedFile = null;

        // Firefox fix: preventDefault is REQUIRED on dragover
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('border-cyan-400', 'bg-slate-800/50');
            dropZone.classList.remove('border-slate-600');
        });

        dropZone.addEventListener('dragenter', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('border-cyan-400', 'bg-slate-800/50');
            dropZone.classList.remove('border-slate-600');
        });

        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('border-cyan-400', 'bg-slate-800/50');
            dropZone.classList.add('border-slate-600');
        });

        // Firefox fix: preventDefault is REQUIRED on drop
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('border-cyan-400', 'bg-slate-800/50');
            dropZone.classList.add('border-slate-600');

            var files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFile(files[0]);
            }
        });

        dropZone.addEventListener('click', function() {
            if (!selectedFile) fileInput.click();
        });

        fileInput.addEventListener('change', function() {
            if (this.files.length > 0) handleFile(this.files[0]);
        });

        removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            clearSelection();
        });

        uploadBtn.addEventListener('click', function() {
            if (!selectedFile) return;
            uploadFile(selectedFile);
        });

        function handleFile(file) {
            selectedFile = file;
            fileName.textContent = file.name;
            fileSize.textContent = formatSize(file.size);
            fileInfo.classList.remove('hidden');
            uploadBtn.disabled = false;
            uploadBtn.className = 'mt-6 w-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 font-bold text-slate-900 cursor-pointer hover:brightness-110 transition-all duration-200';
            uploadBtn.textContent = 'Upload ' + file.name;
            dropText.textContent = 'File selected';
            dropSub.textContent = 'click to choose a different file';
            uploadIcon.textContent = '✅';
        }

        function clearSelection() {
            selectedFile = null;
            fileInfo.classList.add('hidden');
            uploadBtn.disabled = true;
            uploadBtn.className = 'mt-6 w-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 font-bold text-slate-900 opacity-50 cursor-not-allowed transition-all duration-200';
            uploadBtn.textContent = 'Select a file to upload';
            fileInput.value = '';
            dropText.textContent = 'Drag & drop a file here';
            dropSub.textContent = 'or click to browse files';
            uploadIcon.textContent = '📁';
            progressArea.classList.add('hidden');
            statusEl.classList.add('hidden');
        }

        function uploadFile(file) {
            var formData = new FormData();
            formData.append('file', file);

            var xhr = new XMLHttpRequest();

            xhr.upload.onprogress = function(e) {
                progressArea.classList.remove('hidden');
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
                    statusEl.className = 'mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300';
                    statusEl.innerHTML = '<strong>Upload successful!</strong><br>File: ' + data.filename + '<br>Size: ' + formatSize(data.size);
                    statusEl.classList.remove('hidden');
                } else {
                    statusEl.className = 'mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300';
                    statusEl.textContent = 'Upload failed. Please try again.';
                    statusEl.classList.remove('hidden');
                }
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload another file';
            };

            xhr.onerror = function() {
                progressLabel.textContent = 'Error';
                statusEl.className = 'mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300';
                statusEl.textContent = 'Network error. Please check your connection.';
                statusEl.classList.remove('hidden');
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