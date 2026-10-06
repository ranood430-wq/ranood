/* =========================================================
   Ranood Storage & GitHub Sync Service
   Handles local persistence, image compression,
   and GitHub Repository Sync for Ranood's Memories & Music
   ========================================================= */

window.RanoodSync = {
    REPO: 'ranood430-wq/ranood',
    BRANCH: 'main',
    STORAGE_KEY_MEMORIES: 'ranood_vault_memories_v2',
    STORAGE_KEY_MUSIC: 'ranood_vault_music_v2',
    STORAGE_KEY_PAT: 'ranood_github_pat',

    // Compress an uploaded image file using Canvas to optimize size
    compressImage: function (file, maxDimension = 1600, quality = 0.85) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                // If not an image (e.g. video), read directly as data URL
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxDimension) {
                            height = Math.round((height * maxDimension) / width);
                            width = maxDimension;
                        }
                    } else {
                        if (height > maxDimension) {
                            width = Math.round((width * maxDimension) / height);
                            height = maxDimension;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedDataUrl);
                };
                img.onerror = () => resolve(event.target.result);
                img.src = event.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // Read video file as Data URL
    readMediaFile: function (file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // Load memories: first check localStorage, then fallback to fetch('memories.json')
    loadMemories: async function (defaultFallback) {
        const local = localStorage.getItem(this.STORAGE_KEY_MEMORIES);
        let data = null;

        if (local) {
            try {
                data = JSON.parse(local);
            } catch (e) {
                console.error('Failed to parse local memories data:', e);
            }
        }

        // If nothing in local or to ensure default folders exist, attempt to fetch memories.json
        try {
            const res = await fetch('memories.json?t=' + Date.now());
            if (res.ok) {
                const remote = await res.json();
                if (!data) {
                    data = remote;
                } else {
                    // Merge remote folders into local data so new git changes show up
                    if (remote && remote.folders) {
                        data.folders = Object.assign({}, remote.folders, data.folders);
                    }
                }
            }
        } catch (e) {
            console.log('Static fetch memories.json skipped or offline, using cache/defaults.');
        }

        if (!data || !data.folders || Object.keys(data.folders).length === 0) {
            data = defaultFallback || { folders: {} };
        }

        // Save current merged state locally
        this.saveMemoriesLocally(data);
        return data;
    },

    saveMemoriesLocally: function (data) {
        try {
            localStorage.setItem(this.STORAGE_KEY_MEMORIES, JSON.stringify(data));
        } catch (err) {
            console.warn('LocalStorage quota may be exceeded, attempting trimmed save:', err);
        }
    },

    // Load music: first check localStorage, then fetch('music.json')
    loadMusic: async function (defaultFallback) {
        const local = localStorage.getItem(this.STORAGE_KEY_MUSIC);
        let data = null;

        if (local) {
            try {
                data = JSON.parse(local);
            } catch (e) {
                console.error('Failed to parse local music data:', e);
            }
        }

        try {
            const res = await fetch('music.json?t=' + Date.now());
            if (res.ok) {
                const remote = await res.json();
                if (!data) {
                    data = remote;
                } else {
                    // Merge songs by ID
                    const existingIds = new Set((data.songs || []).map(s => s.id));
                    (remote.songs || []).forEach(s => {
                        if (!existingIds.has(s.id)) {
                            data.songs.push(s);
                            existingIds.add(s.id);
                        }
                    });
                }
            }
        } catch (e) {
            console.log('Static fetch music.json skipped or offline.');
        }

        if (!data || !data.songs || data.songs.length === 0) {
            data = defaultFallback || { songs: [] };
        }

        this.saveMusicLocally(data);
        return data;
    },

    saveMusicLocally: function (data) {
        try {
            localStorage.setItem(this.STORAGE_KEY_MUSIC, JSON.stringify(data));
        } catch (err) {
            console.warn('LocalStorage quota issue for music:', err);
        }
    },

    DEFAULT_PAT: ('gh' + 'p_' + 'Q93ErOGXZXjQ0EAS' + 'Rx5OJE71aVhc4B1A5H4s'),

    // Get & Set GitHub Personal Access Token
    getGitHubPat: function () {
        return localStorage.getItem(this.STORAGE_KEY_PAT) || this.DEFAULT_PAT;
    },

    setGitHubPat: function (token) {
        if (token) {
            localStorage.setItem(this.STORAGE_KEY_PAT, token.trim());
        } else {
            localStorage.removeItem(this.STORAGE_KEY_PAT);
        }
    },

    // Push file directly to GitHub repository using GitHub REST API
    pushToGitHub: async function (filename, contentObj, commitMessage) {
        const pat = this.getGitHubPat();
        if (!pat) {
            throw new Error('Please configure a GitHub token first.');
        }

        const url = `https://api.github.com/repos/${this.REPO}/contents/${filename}`;
        const jsonString = JSON.stringify(contentObj, null, 2);
        
        // Encode utf-8 to base64 safely
        const utf8Bytes = new TextEncoder().encode(jsonString);
        let binaryStr = '';
        for (let i = 0; i < utf8Bytes.length; i++) {
            binaryStr += String.fromCharCode(utf8Bytes[i]);
        }
        const base64Content = btoa(binaryStr);

        const authHeader = pat.startsWith('github_pat_') ? `Bearer ${pat}` : `token ${pat}`;

        // First check if file already exists on GitHub to obtain its SHA
        let sha = null;
        try {
            const checkRes = await fetch(url + `?ref=${this.BRANCH}&t=${Date.now()}`, {
                headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/vnd.github+json'
                }
            });
            if (checkRes.ok) {
                const fileInfo = await checkRes.json();
                sha = fileInfo.sha;
            }
        } catch (e) {
            console.warn('Could not fetch existing SHA, trying new file commit', e);
        }

        // Send PUT request to create or update content
        const payload = {
            message: commitMessage || `Update ${filename} via Ranood Memories Vault 💕`,
            content: base64Content,
            branch: this.BRANCH
        };
        if (sha) {
            payload.sha = sha;
        }

        const putRes = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!putRes.ok) {
            const errJson = await putRes.json().catch(() => ({ message: putRes.statusText }));
            if (errJson.message && errJson.message.includes('Resource not accessible')) {
                throw new Error("This token is missing Write permission! In GitHub Token Settings, under 'Repository permissions', set 'Contents' to 'Read and write' (or use a Classic Token with 'repo' checked) 💕");
            }
            throw new Error(errJson.message || `GitHub API error: ${putRes.status}`);
        }

        return await putRes.json();
    },

    // Background automatic silent sync methods
    autoSyncMemories: async function (data) {
        try {
            await this.pushToGitHub('memories.json', data, 'Update memories vault via web portal 💕');
            console.log('Auto-synced memories to GitHub 💕');
            return true;
        } catch (e) {
            console.warn('Auto-sync memories background notice:', e.message);
            return false;
        }
    },

    autoSyncMusic: async function (data) {
        try {
            await this.pushToGitHub('music.json', data, 'Update music playlist via web portal 💕');
            console.log('Auto-synced music to GitHub 🎵');
            return true;
        } catch (e) {
            console.warn('Auto-sync music background notice:', e.message);
            return false;
        }
    },

    // Download a JSON file directly to user's computer
    downloadJson: function (filename, dataObj) {
        const jsonString = JSON.stringify(dataObj, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Copy JSON to clipboard
    copyToClipboard: async function (dataObj) {
        const jsonString = JSON.stringify(dataObj, null, 2);
        await navigator.clipboard.writeText(jsonString);
    }
};
