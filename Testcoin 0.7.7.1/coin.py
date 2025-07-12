import subprocess
import sys
def ensure_packages_installed():
    package_map = {
        'Crypto': 'pycryptodome',
        'requests': 'requests',
        'colorama': 'colorama'
    }
    for module_name, package_name in package_map.items():
        try:
            __import__(module_name)
        except ModuleNotFoundError:
            print(f"Module '{module_name}' not found. Installing '{package_name}'...")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", package_name])
                print(f"Successfully installed '{package_name}'.")
            except Exception as e:
                print(f"Failed to install '{package_name}': {e}")
                sys.exit(1)
ensure_packages_installed()
import json
import os
import requests
import zipfile
import time
from datetime import datetime
from requests.exceptions import ConnectionError, Timeout
from http.client import IncompleteRead
from urllib.parse import parse_qs, urlparse, unquote
import argparse
import tempfile
import socket
import http.server
import webbrowser
import socketserver
import threading
import uuid
import platform
import colorama
from colorama import Fore, Style
import PlayFab
from PlayFab import Search_name, LoginWithCustomId, GetEntityToken, process_friendlyuuid
import re
import shutil
import tsv
import dlc

def clear_console():
    os_name = platform.system()
    if os_name == 'Windows':
        os.system('cls')
    else:
        os.system('clear')

clear_console()

# Initialize colorama
colorama.init()

title = colorama.Fore.YELLOW + r"""
 _____         _            _       
|_   _|       | |          (_)      
  | | ___  ___| |_ ___ ___  _ _ __  
  | |/ _ \/ __| __/ __/ _ \| | '_ \ 
  | |  __/\__ \ || (_| (_) | | | | |
  \_/\___||___/\__\___\___/|_|_| |_| 0.7.7.1""" + colorama.Style.RESET_ALL

print(title)
print()
auth_token = None

def parse_list_files(file_paths):
    combined_data = []
    seen_uuids = set()
    
    for file_path in file_paths:
        try:
            with open(file_path, 'r') as file:
                for line in file:
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        parts = line.rsplit(' - ', 1)
                        title_creator = parts[0].strip()
                        type_uuid = parts[1].strip()

                        type_, uuid = type_uuid.split(' ', 1)
                        type_ = type_.strip()
                        uuid = uuid.strip()

                        title, creator = title_creator.rsplit('(', 1)
                        title = title.strip()
                        creator = creator.strip(' )')

                        if uuid not in seen_uuids:
                            combined_data.append({
                                'title': title,
                                'creator': creator,
                                'uuid': uuid,
                                'type': type_
                            })
                            seen_uuids.add(uuid)
                    except (ValueError, IndexError):
                        print(f"Skipping malformed line: {line}")
        except FileNotFoundError:
            pass
        except IOError as e:
            print(f"Error reading file {file_path}: {e}")

    for entry in combined_data:
        if entry['type'] == 'DLC':
            entry['type'] = 'world template'

    # Invert the order of the list
    return combined_data[::-1]

def generate_html(data):
    table_rows = ""
    for item in data:
        row = f"""
            <tr class="content-row">
                <td><span class="title-link" onclick="fetchDetails('{item['uuid']}')">{item['title']} [ {item['creator']} ]</span></td>
                <td>{item['type']}</td>
                <td>{item['uuid']}</td>
            </tr>
            """
        table_rows += row

    return f"""
<!DOCTYPE html>
<html>
<head>
    <title>DLC List</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {{
            font-family: Arial, sans-serif;
            background-color: #36393f;
            color: #dcddde;
            margin: 0;
            padding: 10px;
        }}
        
        .container {{
            max-width: 100%;
            margin: 0 auto;
            padding: 0 10px;
        }}

        .header {{
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
            padding: 10px;
            background-color: #2f3136;
            border-radius: 8px;
        }}

        .search-container {{
            flex-grow: 1;
            display: flex;
            gap: 10px;
        }}

        .button-container {{
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }}

        .download-button {{
            background-color: #5865f2;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}

        .download-button:hover {{
            background-color: #4752c4;
        }}

        .download-button:disabled {{
            background-color: #72767d;
            cursor: not-allowed;
        }}

        .search-input {{
            flex-grow: 1;
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            background-color: #40444b;
            color: #ffffff;
            font-size: 14px;
        }}

        .search-input::placeholder {{
            color: #72767d;
        }}

        .search-input:focus {{
            outline: none;
            box-shadow: 0 0 0 2px #5865f2;
        }}

        .counter {{
            padding: 8px 12px;
            background-color: #40444b;
            border-radius: 4px;
            color: #ffffff;
            font-size: 14px;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            background-color: #2f3136;
            border-radius: 8px;
            overflow: hidden;
            font-size: 14px;
        }}
        
        th, td {{
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #40444b;
        }}
        
        th {{
            background-color: #202225;
            color: #ffffff;
            font-weight: bold;
        }}
        
        tr:hover {{
            background-color: #40444b;
        }}
        
        .title-link {{
            color: #00b0f4;
            text-decoration: none;
            cursor: pointer;
        }}
        
        .title-link:hover {{
            text-decoration: underline;
        }}
        
        #detailsModal {{
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
        }}

        .modal {{
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 1000;
        }}

        .modal-content {{
            background-color: #36393f;
            margin: 5% auto;
            padding: 20px;
            width: 90%;
            max-width: 800px;
            border-radius: 8px;
            position: relative;
            max-height: 80vh;
            overflow-y: auto;
        }}
        
        .close {{
            color: #72767d;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }}

        .yt-link-container {{
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 8px;
        }}

        .video-link {{
            color: #00b0f4;
            text-decoration: none;
        }}

        .video-link:hover {{
            text-decoration: underline;
        }}

        .yt-logo {{
            width: 24px;
            height: 24px;
        }}
        
        .close:hover {{
            color: #ffffff;
        }}
        
        .search-button, .clear-button {{
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        }}

        .search-button {{
            background-color: #5865f2;
            color: white;
        }}

        .search-button:hover {{
            background-color: #4752c4;
        }}

        .clear-button {{
            background-color: #4f545c;
            color: white;
        }}

        .clear-button:hover {{
            background-color: #646970;
        }}

        #itemDetails {{
            padding: 15px;
        }}
        
        #itemImage {{
            width: 100%;
            max-width: 500px;
            margin: 0 auto 20px auto;
            text-align: center;
        }}
        
        #itemImage img {{
            max-width: 100%;
            border-radius: 8px;
        }}
        
        #itemTitle {{
            color: #ffffff;
            margin-top: -8px;
            margin-bottom: 10px;
            font-size: 24px;
        }}
        
        .content-container {{
            background-color: #2f3136;
            padding: 15px;
            border-radius: 5px;
            margin-top: 10px;
        }}

        .id-container {{
            color: #72767d;
            margin: 10px 0;
            font-family: monospace;
        }}

        #itemDescription {{
            line-height: 1.5;
            white-space: pre-wrap;
        }}
        
        
        .hidden {{
            display: none;
        }}

        .downloads-section {{
            background-color: #2f3136;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }}

        .downloads-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }}

        .downloads-title {{
            font-size: 20px;
            font-weight: bold;
            color: #ffffff;
        }}

        .downloads-refresh {{
            background-color: #5865f2;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }}

        .downloads-refresh:hover {{
            background-color: #4752c4;
        }}

        .downloads-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px;
        }}

        .pack-card {{
            background-color: #40444b;
            border-radius: 8px;
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }}

        .pack-name {{
            color: #ffffff;
            font-weight: bold;
            word-break: break-word;
        }}

        .pack-type {{
            color: #72767d;
            font-size: 12px;
        }}

        .pack-actions {{
            display: flex;
            gap: 8px;
            margin-top: auto;
        }}

        .pack-button {{
            flex: 1;
            padding: 8px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        }}

        .import-button {{
            background-color: #5865f2;
            color: white;
        }}

        .import-button:hover {{
            background-color: #4752c4;
        }}

        @media (max-width: 768px) {{
			.header {{
				flex-direction: column;
				align-items: stretch;
				gap: 10px;
			}}

            th, td {{
                padding: 8px 10px;
                font-size: 12px;
            }}

            .search-container {{
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                align-items: center;
            }}

            .search-input {{
                flex: 1 1 100%;
                min-width: 50%;
                padding: 8px 12px;
                box-sizing: border-box;
            }}

			.search-button, .clear-button {{
				flex: 1 1 auto;
				padding: 8px 12px;
				font-size: 14px;
			}}

            .counter {{
                flex: 0 1 auto;
                padding: 8px 12px;
                font-size: 12px;
                text-align: center;
                background-color: #40444b;
                border-radius: 4px;
                white-space: nowrap;
            }}
        }}

    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="search-container">
                <input type="text" 
                    class="search-input" 
                    placeholder="Search..." 
                    id="searchInput">
                <button class="search-button" onclick="filterTable()">
                    Search
                </button>
                <button class="clear-button" onclick="clearSearch()">
                    Clear
                </button>
                <button class="search-button" onclick="toggleDownloads()">
                    Downloads
                </button>
            </div>
            <div class="counter" id="itemCounter">
                Items: {len(data)}
            </div>
        </div>

        <table>
            <tr>
                <th>Title [ Creator Name ]</th>
                <th>Pack Type</th>
                <th>UUID</th>
            </tr>
            {table_rows}
        </table>
        <div id="downloadsModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeDownloadsModal()">&times;</span>
                <div class="downloads-section">
                    <div class="downloads-header">
                        <div class="downloads-title">Downloads</div>
                        <button class="downloads-refresh" onclick="refreshDownloads()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M23 4v6h-6"></path>
                                <path d="M1 20v-6h6"></path>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                                <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
                            </svg>
                            Refresh
                        </button>
                    </div>
                    <div class="downloads-grid" id="downloadsGrid">
                    
                    </div>
                </div>
            </div>
        </div>

    <div id="detailsModal">
        <div class="modal-content">
            <span class="close" onclick="closeModal()">&times;</span>
            <div id="itemDetails">
                <div id="itemImage"></div>
                <h2 id="itemTitle"></h2>
                <div id="itemDescription"></div>
            </div>
        </div>
    </div>

    <script>

        // Store all rows for quick access
        let allRows;
        
        // Initialize on page load
        window.onload = function() {{
            allRows = Array.from(document.getElementsByClassName('content-row'));
            document.getElementById('searchInput').addEventListener('keypress', function(e) {{
                if (e.key === 'Enter') {{
                    filterTable();
                }}
            }});
        }}

        function filterTable() {{
            const input = document.getElementById('searchInput');
            const filter = input.value.toLowerCase();
            let visibleCount = 0;

            allRows.forEach(row => {{
                const cells = row.getElementsByTagName('td');
                const titleCell = cells[0].textContent || cells[0].innerText;
                const typeCell = cells[1].textContent || cells[1].innerText;
                const uuidCell = cells[2].textContent || cells[2].innerText;

                if (
                    titleCell.toLowerCase().includes(filter) ||
                    typeCell.toLowerCase().includes(filter) ||
                    uuidCell.toLowerCase().includes(filter)
                ) {{
                    row.classList.remove('hidden');
                    visibleCount++;
                }} else {{
                    row.classList.add('hidden');
                }}
            }});

            // Update counter
            document.getElementById('itemCounter').textContent = `Items: ${{visibleCount}}`;
        }}

        function toggleDownloads() {{
            const modal = document.getElementById('downloadsModal');
            modal.style.display = 'block';
            refreshDownloads();
        }}

        function closeDownloadsModal() {{
            const modal = document.getElementById('downloadsModal');
            modal.style.display = 'none';
        }}

        window.onclick = function(event) {{
            const modal = document.getElementById('downloadsModal');
            if (event.target == modal) {{
                closeDownloadsModal();
            }}
        }}

        function clearSearch() {{
            const input = document.getElementById('searchInput');
            input.value = '';
            allRows.forEach(row => row.classList.remove('hidden'));
            document.getElementById('itemCounter').textContent = `Items: ${{allRows.length}}`;
        }}

        function downloadItem(encodedItemData) {{
            const button = document.querySelector('.download-button');
            button.disabled = true;
            button.textContent = 'Processing...';

            // Decode the URL-encoded data
            const itemData = JSON.parse(decodeURIComponent(encodedItemData));

            fetch('/process_download', {{
                method: 'POST',
                headers: {{
                    'Content-Type': 'application/json',
                }},
                body: JSON.stringify({{
                    items: [itemData],
                    use_playfab: false
                }})
            }})
            .then(response => {{
                if (!response.ok) throw new Error('Download failed');
                return response.json();
            }})
            .then(data => {{
                button.textContent = 'Downloaded';
            }})
            .catch(error => {{
                button.textContent = 'Download Failed';
                console.error('Error:', error);
            }})
            .finally(() => {{
                setTimeout(() => {{
                    button.disabled = false;
                    button.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download
                    `;
                }}, 2000);
            }});
        }}
        
        function fetchDetails(uuid) {{
            document.getElementById('detailsModal').style.display = 'block';
            document.getElementById('itemDetails').innerHTML = '<div style="text-align: center;">Loading...</div>';
            
            fetch(`/search?uuid=${{encodeURIComponent(uuid)}}`)
                .then(response => response.json())
                .then(data => {{
                    const itemData = data[uuid];
                    if (!itemData) {{
                        throw new Error('Item not found');
                    }}

                    let detailsHTML = '';

                    // Image
                    if (itemData.Images && itemData.Images.length > 0) {{
                        const thumbnailImage = itemData.Images.find(img => img.Type === 'Thumbnail');
                        if (thumbnailImage) {{
                            detailsHTML += `
                                <div id="itemImage">
                                    <img src="${{thumbnailImage.Url}}" alt="Item thumbnail">
                                </div>`;
                        }}
                    }}

                    // Title
                    const title = itemData.Title?.['en-US'] || itemData.Title?.NEUTRAL || 'No title available';
                    detailsHTML += `<h2 id="itemTitle">${{title}}</h2>`;

                    // Description
                    const description = itemData.Description?.['en-US'] || itemData.Description?.NEUTRAL || 'No description available';
                    detailsHTML += `<div class="content-container">`;
                    detailsHTML += `<div id="itemDescription">${{description}}</div>`;

                    // Video URL
                    const videoUrl = itemData.DisplayProperties?.videoUrl;
                    if (videoUrl) {{
                        detailsHTML += `
                            <div class="yt-link-container">
                                <svg class="yt-logo" viewBox="0 0 504.24 385.2">
                                    <path d="M457.7,0c.26.22.24.51.26.81.4,8.24-.34,16.83-.02,25.11h23.27v24.24h23.03v288.48h-23.03v22.2s-.33.36-.36.36h-22.91c-.34,7.61.45,15.62.02,23.19-.02.3,0,.59-.26.81H48.46v-24h-25.19v-22.56H0V50.16h23.27v-24.24h25.19V0h409.25Z" style="fill: #fa0002;"/>
                                    <path d="M219.5,96.72v23.28h46.78v25.92h46.18s.36.33.36.36v20.28h51.1v51.12h-51.1v24.24h-46.54v25.92h-46.78v22.56h-51.7s-.36-.33-.36-.36V96.72h52.06Z" style="fill: #fefefe;"/>
                                </svg>
                                <a href="${{videoUrl}}" target="_blank" class="video-link">
                                    Watch Video
                                </a>
                            </div>`;
                    }}

                    detailsHTML += `</div>`; // Close the itemDescription div

                    // UUID
                    detailsHTML += `<div class="id-container">`;
                    detailsHTML += `UUID: ${{uuid}}<br>`;
                    detailsHTML += `</div>`;

                // Download Button (without embedding onclick directly)
                detailsHTML += `
                    <div class="button-container">
                        <button class="download-button">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Download
                        </button>
                    </div>`;

                // Set the HTML content
                document.getElementById('itemDetails').innerHTML = detailsHTML;

                // Add event listener for the download button
                const downloadButton = document.querySelector('.download-button');
                downloadButton.addEventListener('click', function () {{
                    const encodedItemData = encodeURIComponent(JSON.stringify(itemData)); // Encode the itemData before passing it
                    downloadItem(encodedItemData); // Pass the encoded data to the function
                }});
            }})
            .catch(error => {{
                document.getElementById('itemDetails').innerHTML = 
                    `<div class="error" style="color: #ff6b6b;">Error: ${{error.message}}</div>`;
            }});
        }}
        
        function closeModal() {{
            document.getElementById('detailsModal').style.display = 'none';
        }}
        
        window.onclick = function(event) {{
            if (event.target == document.getElementById('detailsModal')) {{
                closeModal();
            }}
        }}

        // New functions for Downloads section
        function refreshDownloads() {{
            fetch('/list_packs')
                .then(response => response.json())
                .then(files => {{
                    const grid = document.getElementById('downloadsGrid');
                    grid.innerHTML = '';
                    
                    files.forEach(file => {{
                        const card = document.createElement('div');
                        card.className = 'pack-card';
                        
                        const extension = file.split('.').pop().toLowerCase();                        
                        card.innerHTML = `
                            <div class="pack-name">${{file}}</div>
                            <div class="pack-actions">
                                <button class="pack-button import-button" onclick="importPack('${{file}}')">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7 10 12 15 17 10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                    Import
                                </button>
                            </div>
                        `;
                        
                        grid.appendChild(card);
                    }});
                }})
                .catch(error => console.error('Error loading packs:', error));
        }}
        
        function isMobileDevice() {{
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }}

        function importPack(filename) {{
            const encodedFilename = encodeURIComponent(filename);

            if (isMobileDevice()) {{
                // For mobile, initiate file download
                window.location.href = `/import_pack/${{encodedFilename}}`;
            }} else {{
                // For desktop, use fetch to import the pack
                fetch(`/import_pack/${{encodedFilename}}`, {{
                    headers: {{
                        'X-Requested-With': 'XMLHttpRequest' // Indicate fetch request
                    }}
                }})
                    .then(response => {{
                        if (!response.ok) {{
                            return response.json().then(data => {{
                                throw new Error(data.error || "Unknown error occurred");
                            }});
                        }}
                        return response.json();
                    }})
                    .then(data => {{
                        if (data.error) {{
                            alert('Error importing pack: ' + data.error);
                        }} else {{
                            alert('Pack imported successfully!');
                        }}
                    }})
                    .catch(error => {{
                        console.error('Error:', error);
                        alert('Failed to import pack: ' + error.message);
                    }});
            }}
        }}
        
        // Load downloads when page loads
        window.addEventListener('load', () => {{
            refreshDownloads();
        }});

    </script>
</body>
</html>
"""

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urlparse(self.path)
        
        if parsed_url.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            file_paths = ['list.txt', 'personal_list.txt']
            combined_data = parse_list_files(file_paths)
            html_content = generate_html(combined_data)
            self.wfile.write(html_content.encode('utf-8'))

        elif parsed_url.path == '/list_packs':
            try:
                pack_files = []
                if os.path.exists('packs'):
                    for file in os.listdir('packs'):
                        if file.lower().endswith(('.mcpack', '.mctemplate', '.mcaddon', '.mcworld')):
                            pack_files.append(file)

                if is_running_in_termux():
                    termux_dir = '/data/data/com.termux/files/home/storage/downloads/testcoin'
                    if os.path.exists(termux_dir):
                        for file in os.listdir(termux_dir):
                            if file.lower().endswith(('.mcpack', '.mctemplate', '.mcaddon', '.mcworld')):
                                pack_files.append(file)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(pack_files).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

        elif parsed_url.path.startswith('/import_pack/'):
            try:
                # Extract filename
                if len(parsed_url.path.split('/')) <= 2:
                    raise ValueError("No filename specified in the URL")

                filename = unquote(os.path.basename(parsed_url.path))
                if not filename:
                    raise ValueError("Invalid filename provided")

                # Locate file in directories
                directories = ['packs']
                if is_running_in_termux():
                    directories.append('/data/data/com.termux/files/home/storage/downloads/testcoin')

                filepath = None
                for directory in directories:
                    potential_path = os.path.join(os.getcwd(), directory, filename)
                    if os.path.exists(potential_path) and os.path.isfile(potential_path):
                        filepath = potential_path
                        break

                if filepath and os.path.abspath(filepath).startswith(os.path.abspath(directory)):
                    # Check if it's a desktop fetch request
                    if self.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        if os.name == 'nt':  # Windows platform
                            try:
                                os.startfile(filepath)  # Import the pack
                                self.send_response(200)
                                self.send_header('Content-Type', 'application/json')
                                self.end_headers()
                                self.wfile.write(json.dumps({'status': 'success', 'message': 'Pack imported successfully'}).encode('utf-8'))
                            except Exception as e:
                                self.send_response(500)
                                self.send_header('Content-Type', 'application/json')
                                self.end_headers()
                                self.wfile.write(json.dumps({'error': f'Failed to import pack: {str(e)}'}).encode('utf-8'))
                        else:
                            self.send_response(400)
                            self.send_header('Content-Type', 'application/json')
                            self.end_headers()
                    else:
                        # Serve file for mobile (download)
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/octet-stream')
                        self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                        self.send_header('Content-Length', str(os.path.getsize(filepath)))
                        self.end_headers()

                        with open(filepath, 'rb') as file:
                            self.wfile.write(file.read())
                else:
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'File not found'}).encode('utf-8'))
            except ValueError as ve:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(ve)}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Internal server error'}).encode('utf-8'))
                
        elif parsed_url.path.startswith('/packs/'):
            try:
                filename = unquote(os.path.basename(parsed_url.path))
                directories = ['packs']
                if is_running_in_termux():
                    directories.append('/data/data/com.termux/files/home/storage/downloads/testcoin')

                filepath = None
                for directory in directories:
                    potential_path = os.path.join(os.getcwd(), directory, filename)
                    if os.path.exists(potential_path) and os.path.isfile(potential_path):
                        filepath = potential_path
                        break

                if filepath and os.path.abspath(filepath).startswith(os.path.abspath(directory)):
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/octet-stream')
                    self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                    self.send_header('Content-Length', str(os.path.getsize(filepath)))
                    self.end_headers()

                    with open(filepath, 'rb') as f:
                        self.wfile.write(f.read())
                else:
                    self.send_error(404, "File not found")
            except Exception as e:
                print(f"Error serving file: {str(e)}")
                self.send_error(500, f"Internal server error: {str(e)}")

        elif parsed_url.path == '/search':
            if not auth_token:
                self.send_response(401)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Not authenticated'}).encode('utf-8'))
                return
                
            query_components = parse_qs(parsed_url.query)
            uuid = query_components.get('uuid', [''])[0]
            
            try:
                result = PlayFab.main(uuid)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
        
        else:
            self.send_error(404)
            
    def do_POST(self):
        if self.path == '/process_download':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            try:
                result = data
                process_custom_ids(result)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

def is_running_in_termux():
    #Check if it's running on Termux
    return 'TERMUX_VERSION' in os.environ

def is_running_in_pydroid():
    #Check if it's running on Pydroid
    return 'PYDROID_RPC' in os.environ

def open_url(url):
    #Open URL based on the environment
    if is_running_in_termux():
        try:
            subprocess.run(['termux-open-url', url])
        except FileNotFoundError:
            print("Warning: termux-open-url command not found. Please install termux-api package.")
            print(f"URL to open manually: {url}")
    else:
        webbrowser.open(url)

def is_port_in_use(port):
    #Check if a port is already in use
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('127.0.0.1', port))
            return False
        except OSError:
            return True

def find_free_port(start_port=8000, max_attempts=10):
    #Find a free port starting from start_port
    port = start_port
    for _ in range(max_attempts):
        if not is_port_in_use(port):
            return port
        port += 1
    raise RuntimeError(f"No free ports found between {start_port} and {start_port + max_attempts - 1}")

def cleanup_port(port):
    if is_running_in_termux():
        try:
            subprocess.run(['fuser', '-k', f'{port}/tcp'], capture_output=True)
            time.sleep(1)
        except FileNotFoundError:
            print("Note: 'fuser' command not found. Install it with 'pkg install psmisc' if needed.")

def run_web():
    initial_port = 8000
    
    try:
        if is_port_in_use(initial_port):
            cleanup_port(initial_port)
        
        # find a free port
        port = initial_port if not is_port_in_use(initial_port) else find_free_port(initial_port)
        
        with socketserver.TCPServer(('127.0.0.1', port), CustomHandler) as httpd:
            url = f"http://127.0.0.1:{port}"
            print(f"\nOpen the browser and paste this link: {url}")
            print("(Type 'C' to stop the server)\n")
            
            # Open URL based on environment
            open_url(url)
            
            server_running = threading.Event()
            server_running.set()

            def check_input():
                while server_running.is_set():
                    try:
                        if input().lower() == 'c':
                            server_running.clear()
                            httpd.shutdown()
                            break
                    except (EOFError, KeyboardInterrupt):
                        break

            # Start input thread
            input_thread = threading.Thread(target=check_input)
            input_thread.daemon = True
            input_thread.start()
            
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                pass
            finally:
                server_running.clear()
                print("\nShutting down server...")
                httpd.server_close()
                cleanup_port(port)
                
    except Exception as e:
        print(f"\nError starting server: {e}")
        if isinstance(e, OSError) and e.errno == 98:
            print("\nError: Port is already in use. Please try again in a few moments.")
        raise

def download_progress(downloaded, total_size):
    percent = int((downloaded / total_size) * 100)
    print(f"\rDownloading: {percent}%", end="", flush=True)

# Extract ID from URL
def extract_id_from_url(url):
    id_param_pattern = r'id=([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'
    path_uuid_pattern = r'([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'
    match = re.search(path_uuid_pattern, url, re.I)
    if match:
        return match.group(1)
    match = re.search(id_param_pattern, url, re.I)
    if match:
        return match.group(1)
    return None

def load_keys_from_files():
    files_to_check = ["keys.tsv", "personal_keys.tsv"]
    loaded_lines = []

    for file_name in files_to_check:
        try:
            with open(file_name, "r") as keys_file:
                loaded_lines.extend(keys_file.readlines())
        except FileNotFoundError:
            if file_name == "keys.tsv":
                print("'keys.tsv' file not found.")
            continue

    return loaded_lines

def check_custom_id(custom_ids, loaded_lines):
    if isinstance(custom_ids, str):
        custom_ids = {custom_ids}
    elif isinstance(custom_ids, list):
        custom_ids = set(custom_ids)

    for line in loaded_lines:
        for id in custom_ids:
            if id in line:
                return True

    return False

# --help
def display_help():
    help_message = f"""
    Instructions usage commands:

    {Fore.YELLOW}--web{Style.RESET_ALL} / generate a webpage of the available items in the keys 
    and host it locally

    {Fore.YELLOW}--dlc{Style.RESET_ALL} / get the list of worldtemplate available in keys

    {Fore.YELLOW}--addon{Style.RESET_ALL} / get the list of all addons

    {Fore.YELLOW}--skin{Style.RESET_ALL} / get the list of the first 300 skins

    {Fore.YELLOW}--mashup{Style.RESET_ALL} / get the list of all mashup

    {Fore.YELLOW}--texture{Style.RESET_ALL} / get the list of all texture packs

    {Fore.YELLOW}--persona (name){Style.RESET_ALL} / search for persona items,
        example: --persona mcc crown
    
    {Fore.YELLOW}--capes{Style.RESET_ALL} / get the list of all capes

    {Fore.YELLOW}--newest{Style.RESET_ALL} / display first 300 latest items 

    {Fore.YELLOW}--hidden{Style.RESET_ALL} / display first 300 unlisted items

    {Fore.YELLOW}--allhidden{Style.RESET_ALL} / display all the unlisted items

    {Fore.YELLOW}--list{Style.RESET_ALL} / display the list of the items present on the keys.tsv

    {Fore.YELLOW}--of{Style.RESET_ALL} / activate offline search,
        its gonna display only the items in keys

    {Fore.YELLOW}--all{Style.RESET_ALL} / select every numbers on the list 
        note: this is gonna download everything
        present on the list

    {Fore.YELLOW}--reload{Style.RESET_ALL} / force reload keys.tsv-list.txt update

    {Fore.YELLOW}--new{Style.RESET_ALL} / display new added items

    {Fore.YELLOW}--extra{Style.RESET_ALL} / display extra features

    {Fore.YELLOW}--exit{Style.RESET_ALL} / exit the program

"""
    print(help_message)

def count_keys():
    personal_keys_file = "personal_keys.tsv"
    if os.path.exists(personal_keys_file):
        with open(personal_keys_file, "r", encoding="utf-8") as file:
            return sum(1 for _ in file)
    return None

# --extra
def display_extra():
    settings = load_settings()

    display_last_modified_date = settings.get("DisplayLastModifiedDate", "False")
    update_keys = settings.get("UpdateKeys", "True")

    display_status = "ON" if display_last_modified_date == "True" else "OFF"
    update_keys_status = "ON" if update_keys == "True" else "OFF"

    keys_url = settings.get("tsv", "Default")
    list_url = settings.get("list", "Default")

    loaded_keys_count = count_keys()
    loaded_keys_text = f"{Fore.CYAN}{loaded_keys_count}{Style.RESET_ALL}" if loaded_keys_count is not None else f"{Fore.CYAN}None{Style.RESET_ALL}"

    extra_message = f"""
    Extra features:

    Loaded keys: {loaded_keys_text}
    {Fore.YELLOW}--dbkeys (file_path){Style.RESET_ALL} / Convert keys generated from McDecryptor
        example: --dbkeys keys.db / If the file path is not provided is gonna search and display the files
    {Fore.YELLOW}--dblist{Style.RESET_ALL} / Display the list of the converted keys

    Display Last Modified Date: {Fore.GREEN if display_status == "ON" else Fore.RED}{display_status}{Style.RESET_ALL}
    {Fore.YELLOW}--date (ON/OFF){Style.RESET_ALL} / Show the last modified date on DLC
        example: --date ON

    Auto update keys: {Fore.GREEN if update_keys_status == "ON" else Fore.RED}{update_keys_status}{Style.RESET_ALL}
    {Fore.YELLOW}--keys (ON/OFF){Style.RESET_ALL} / Enable or disable automatic key updates

    Keys URL: {Fore.CYAN}{keys_url}{Style.RESET_ALL}
    List URL: {Fore.CYAN}{list_url}{Style.RESET_ALL}
    {Fore.YELLOW}--urlkeys url{Style.RESET_ALL} / Custom url for keys.tsv
    {Fore.YELLOW}--urllist url{Style.RESET_ALL} / Custom url for list.txt
    {Fore.YELLOW}--urlreset{Style.RESET_ALL} / Remove the custom urls
        example: --urlkeys https://example.com/keys.txt
    """
    print(extra_message)


def update_keys():
    global global_new_lines
    try:
        tsv.force_update_keys()
        global_new_lines, _ = tsv.check_dlc_list(force_update_list=True)
    except Exception as e:
        log_error(None, e)

def login():
    global auth_token
    print("API Login...", end="", flush=True)
    response = LoginWithCustomId()
    if 'PlayFabId' in response:
        auth_token = GetEntityToken(response['PlayFabId'], 'master_player_account')
        print("\r" + " " * len("API Login...") + "\r", end="", flush=True)
    else:
        print("\rLogin failed.", end="\n", flush=True)
        return False
    return True

def convert_db_keys(file_path=None):
    selected_file = None
    if not file_path:
        excluded_files = {"error_log.txt", "list.txt", "personal_list.txt"}
        available_files = [f for f in os.listdir() if (f.endswith(".txt") or f.endswith(".db")) and f not in excluded_files]        
        termux_dir = "/data/data/com.termux/files/home/storage/downloads/testcoin"
        if is_running_in_termux() and os.path.exists(termux_dir):
            termux_files = [os.path.join(termux_dir, f) for f in os.listdir(termux_dir)
                           if (f.endswith(".txt") or f.endswith(".db")) and f not in excluded_files]
            available_files.extend(termux_files)            
        if not available_files:
            print("No .txt or .db files found.")
            return
        print("Available files:")
        print()
        for idx, filename in enumerate(available_files, start=1):
            print(f"{idx}. {filename}")            
        try:
            print()
            selection = int(input("Enter the number: ")) - 1
            if 0 <= selection < len(available_files):
                selected_file = available_files[selection]
            else:
                print("Invalid selection. Exiting.")
                return
        except ValueError:
            print("Invalid input. Please enter a number.")
            return
    else:
        selected_file = file_path
    friendlyuuid = {}
    try:
        with open(selected_file, "r", encoding="utf-8") as keys_file:
            lines = [line for line in keys_file if "s5s5ejuDru4uchuF2drUFuthaspAbepE" not in line]            
        for line in lines:
            if "=" not in line:
                print("File with invalid format")
                return
            uuid, key = line.strip().split("=", 1)
            friendlyuuid[uuid] = key            
        process_friendlyuuid(friendlyuuid)
    except FileNotFoundError:
        print(f"Error: {selected_file} not found.")

def perform_search(query, orderBy, select, top, skip, search_type, search_term):
    global auth_token
    if not auth_token:
        if not login():
            return None
    try:
        return Search_name(query=query, orderBy=orderBy, select=select, top=top, skip=skip, search_type=search_type, search_term=search_term)
    except Exception as e:
        if 'Unauthorized' in str(e):
            print("Session expired. Re-authenticating...")
            if login():
                return Search_name(query=query, orderBy=orderBy, select=select, top=top, skip=skip, search_type=search_type, search_term=search_term)
        print(f"An error occurred: {e}")
        return None

def load_settings(file_path="settings.json"):
    try:
        with open(file_path, "r") as file:
            return json.load(file)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def update_settings(file_path="settings.json", key=None, value=None):
    settings = load_settings(file_path)
    settings[key] = value
    with open(file_path, "w") as file:
        file.write(json.dumps(settings, separators=(",", ":")))

def display_items(filtered_items):
    settings = load_settings()
    display_last_modified = settings.get("DisplayLastModifiedDate", "False") == "True"
    preloaded_ids = load_keys_from_files()
    print()
    for idx, item in enumerate(filtered_items, start=1):
        title_en_us = item.get("Title", {}).get("en-US", item.get("Title", {}).get("en-us", "Title not available"))
        creator_name = item.get("DisplayProperties", {}).get("creatorName", "Creator name not available")
        
        if "PersonaDurable" in item.get("ContentType", []):
            pack_type = "Persona"
        elif "skinpack" in item.get("Tags", []):
            pack_type = "SkinPack"
        elif "resourcepack" in item.get("Tags", []):
            pack_type = "TexturePack"
        elif "mashup" in item.get("Tags", []):
            pack_type = "Mashup"
        elif "addon" in item.get("Tags", []):
            pack_type = "Addon"
        else:
            pack_type = "DLC"
            
        if pack_type in ("SkinPack", "Persona"):
            checkbox = Fore.GREEN + "[✓]" + Fore.RESET
        else:
            checkbox = (Fore.GREEN + "[✓]" + Fore.RESET) if check_custom_id(item["Id"], preloaded_ids) else (Fore.RED + "[X]" + Fore.RESET)
        
        if display_last_modified:
            last_updated_iso = item.get("LastModifiedDate")
            if last_updated_iso:
                try:
                    last_updated_dt = datetime.fromisoformat(last_updated_iso.replace("Z", "+00:00"))
                    last_updated = last_updated_dt.strftime("%B %d, %Y, %H:%M")
                except ValueError:
                    last_updated = "Invalid date format"
            else:
                last_updated = ""
            print(f"{idx}) {title_en_us} ( {creator_name} ) {last_updated} - {pack_type} {checkbox}")
        else:
            print(f"{idx}) {title_en_us} ( {creator_name} ) - {pack_type} {checkbox}")
    
    print()

def read_list(personal_only=False):
    unique_lines = set()
    
    if not personal_only:
        try:
            with open("list.txt", "r") as file:
                lines = file.readlines()
                for line in lines:
                    unique_lines.add(line.strip())
        except FileNotFoundError:
            print("'list.txt' file not found.")
    
    try:
        with open("personal_list.txt", "r") as file:
            lines = file.readlines()
            for line in lines:
                unique_lines.add(line.strip())
    except FileNotFoundError:
        pass
    
    return list(unique_lines)

def display_keys_items(filter_keyword=None, personal_only=False):
    lines = read_list(personal_only)
    if filter_keyword:
        # Convert the keyword and each line to lowercase for case-insensitive search
        filter_keyword_lower = filter_keyword.lower()
        filtered_lines = [line for line in lines if filter_keyword_lower in line.lower()]
    else:
        filtered_lines = lines

    print()    
    for idx, line in enumerate(filtered_lines, start=1):
        display_line = re.sub(r'\s*[\da-fA-F-]{36}$', '', line).strip()
        print(f"{idx}) {display_line} {Fore.GREEN}[✓]{Fore.RESET}")
    print()
    return filtered_lines

EXIT_COMMAND = "__EXIT__"
def get_custom_id():
    global global_new_lines
    while True:
        try:
            user_input = input("(type --help for the command instructions)\nEnter the NAME, UUID or URL: ").strip()
        except EOFError:  # This issue happens only on Termux on the first start
            print("\nEOFError encountered.")

            # If running in Termux, try reopening stdin from /dev/tty
            if is_running_in_termux():
                try:
                    print("Attempting to fix...")
                    sys.stdin = open('/dev/tty')
                    time.sleep(1)
                    continue
                except Exception as e:
                    print(f"Failed to reopen stdin: {e}")

            print("Please restart.")
            return EXIT_COMMAND
        

        if user_input.lower() == "--exit":
            print("Exiting the program.")
            return EXIT_COMMAND
        
        if user_input.lower() in ["--help", "--reload", "--list", "--dlc", "--of", "--exit", "--new", "--extra", "--web", "--dblist"]:
            if user_input.lower() == "--reload":
                update_keys()
                continue
            elif user_input.lower() == "--help":
                display_help()
                continue
            elif user_input.lower() == "--extra":
                display_extra()
                continue
            elif user_input.lower() == "--web":
                run_web()
                continue
            elif user_input.lower() == "--dbkeys":
                convert_db_keys()
                continue
            elif user_input.lower() == "--new":
                if global_new_lines:
                    print("Added items in keys:")
                    print()
                    for line in global_new_lines:
                        stripped_line = re.sub(r'\s*[\da-fA-F-]{36}$', '', line).strip()
                        print(stripped_line)
                    print()
                else:
                    print("No new items added.")
                continue

            if user_input.lower() in ["--list", "--dlc"]:
                items = display_keys_items(filter_keyword="DLC" if user_input.lower() == "--dlc" else None)
                if not items:
                    continue
            elif user_input.lower() == "--of":
                search_term = input("Enter search term for offline search: ").strip()
                items = display_keys_items(filter_keyword=search_term)
                if not items:
                    print("Nothing found.")
                    continue
            elif user_input.lower() == "--dblist":
                items = display_keys_items(personal_only=True)
                if not items:
                    print("No list found, convert the keys first.")
                    continue            
            
            while True:
                selected_numbers = input("(Type 'R' to retry the search)\nSelect the number(s) separated by commas: ")
                if selected_numbers.lower() == 'r':
                    break
                elif selected_numbers.lower() == '--all':
                    if user_input.lower() in ["--list", "--dlc", "--of", "--dblist"]:
                        return {"ids": [re.search(r'[\da-fA-F-]{36}', item).group() for item in items], "use_playfab": True}
                    else:
                        return {"ids": [item.get("id") or item.get("Id") for item in items], "use_playfab": True}
                else:
                    selected_ids = process_selected_numbers(selected_numbers, items)
                    if selected_ids:
                        if user_input.lower() in ["--list", "--dlc", "--of"]:
                            return {"ids": [re.search(r'[\da-fA-F-]{36}', items[int(num)-1]).group() for num in selected_numbers.split(',')], "use_playfab": True}
                        else:
                            return {"ids": selected_ids, "use_playfab": True}
                    print("Invalid selection. Please enter valid number(s).")
            continue

        elif user_input.lower().startswith("--urlkeys"):
            command_parts = user_input.split()
            if len(command_parts) > 1:
                url = command_parts[1]
                update_settings(key="tsv", value=url)
                print(f"Custom Keys URL set to: {Fore.GREEN}{url}{Style.RESET_ALL}")
            else:
                print("Invalid usage of --urlkeys. Example: --urlkeys https://example.com/keys.tsv")
            continue

        elif user_input.lower().startswith("--dbkeys"):
            parts = user_input.split(None, 1)
            file_path = parts[1].strip() if len(parts) > 1 else None
            convert_db_keys(file_path)
            continue

        elif user_input.lower().startswith("--urllist"):
            command_parts = user_input.split()
            if len(command_parts) > 1:
                url = command_parts[1]
                update_settings(key="list", value=url)
                print(f"Custom List URL set to: {Fore.GREEN}{url}{Style.RESET_ALL}")
            else:
                print("Invalid usage of --urllist. Example: --urllist https://example.com/list.txt")
            continue

        elif user_input.lower() == "--urlreset":
            try:
                settings = load_settings()
                if "tsv" in settings:
                    del settings["tsv"]
                if "list" in settings:
                    del settings["list"]
                with open("settings.json", "w") as file:
                    json.dump(settings, file)
                print(Fore.GREEN + "Custom URLs have been removed." + Style.RESET_ALL)
            except Exception as e:
                print(Fore.RED + f"Failed to reset URLs: {e}" + Style.RESET_ALL)
            continue

        elif user_input.lower().startswith("--date"):
            command_parts = user_input.split()
            if len(command_parts) > 1 and command_parts[1].upper() in ["ON", "OFF"]:
                status = command_parts[1].upper()
                update_settings(key="DisplayLastModifiedDate", value="True" if status == "ON" else "False")
                
                color = Fore.GREEN if status == "ON" else Fore.RED
                print(f"Display Last Modified Date is now {color}{status}{Style.RESET_ALL}.")
            else:
                print("Invalid usage of --date. Use --date ON or --date OFF.")
            continue
        
        elif user_input.lower().startswith("--keys"):
            command_parts = user_input.split()
            if len(command_parts) > 1 and command_parts[1].upper() in ["ON", "OFF"]:
                status = command_parts[1].upper()
                update_settings(key="UpdateKeys", value="True" if status == "ON" else "False")
                
                color = Fore.GREEN if status == "ON" else Fore.RED
                print(f"Auto update keys is now {color}{status}{Style.RESET_ALL}.")
            else:
                print("Invalid usage of --keys. Use --keys ON or --keys OFF.")
            continue

        elif "id=" in user_input or "minecraft.net" in user_input:
            extracted_id = extract_id_from_url(user_input)
            if extracted_id:
                return {"ids": [extracted_id], "use_playfab": True}
        
        elif all(re.match(r'[\da-fA-F-]{36}', uuid.strip(), re.I) for uuid in user_input.split(',')):
            return {"ids": [uuid.strip() for uuid in user_input.split(',')], "use_playfab": True}
        
        else:
            search_command = "name"
            search_term = user_input
            if user_input.startswith('--'):
                command_parts = user_input.split()
                search_command = command_parts[0][2:]
                search_term = ' '.join(command_parts[1:]) if len(command_parts) > 1 else None

            if search_command not in ["name", "texture", "mashup", "addon", "persona", "capes", "hidden", "allhidden", "newest", "skin"]:
                print(f"Invalid command")
                continue
            
            data = perform_search(query="", orderBy="creationDate DESC", select="contents", top=300, skip=0, search_term=search_term, search_type=search_command)
            items = data.get("Items", []) if isinstance(data, dict) else data

            if items is None:
                continue

            items = [item for item in items if all(term in item.get("Title", {}).get("en-US", "").lower() for term in (search_term.lower().split() if search_term else []))]
            
            if not items:
                print("No result.")
                continue

            while True:
                display_items(items)
                selected_numbers = input("(Type 'R' to retry the search)\nSelect the number(s) separated by commas: ")
                if selected_numbers.lower() == 'r':
                    break
                elif selected_numbers.lower() == '--all':
                    return {"items": items, "use_playfab": False}
                else:
                    selected_ids = process_selected_numbers(selected_numbers, items)
                    if selected_ids:
                        return {"items": [item for item in items if item.get("id") in selected_ids or item.get("Id") in selected_ids], "use_playfab": False}
                    print("Invalid selection. Please enter valid number(s).")

def process_selected_numbers(selected_numbers, items):
    selected_numbers = selected_numbers.replace(" ", "").split(',')
    selected_ids = []
    for number in selected_numbers:
        try:
            selected_idx = int(number) - 1
            if 0 <= selected_idx < len(items):
                if isinstance(items[selected_idx], str):
                    selected_id = re.search(r'[\da-fA-F-]{36}', items[selected_idx]).group()
                else:
                    selected_id = items[selected_idx].get("id") or items[selected_idx].get("Id")
                if selected_id:
                    selected_ids.append(selected_id)
                else:
                    return None
            else:
                return None
        except (ValueError, AttributeError):
            return None
    return selected_ids

def download_and_process_zip(zip_url, output_folder, retries=3, timeout=160):
    retry_count = 0

    while retry_count < retries:
        try:

            response = requests.get(zip_url, timeout=timeout, headers={"User-Agent": "libhttpclient/1.0.0.0"}, stream=True)
            response.raise_for_status()

            total_size = int(response.headers.get('content-length', 0))
            downloaded_size = 0

            url_parts = zip_url.split("/")
            zip_filename = url_parts[-1]

            random_folder_name = uuid.uuid4().hex
            pack_folder = os.path.join(output_folder, random_folder_name)

            os.makedirs(pack_folder, exist_ok=True)

            zip_file_path = os.path.join(pack_folder, zip_filename)
            with open(zip_file_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    downloaded_size += len(chunk)
                    download_progress(downloaded_size, total_size)

            print("\r" + " " * 50 + "\r", end="")
            print("\rExtracting zip file..." + " " * 30, end="\r")
            extracted_pack_folders = []

            with zipfile.ZipFile(zip_file_path, 'r') as zip_ref:
                for name in zip_ref.namelist():
                    if name.endswith('.zip'):
                        nested_zip_file_path = os.path.join(pack_folder, name)
                        nested_pack_folder = os.path.join(pack_folder, os.path.splitext(name)[0])
                        if not os.path.exists(nested_pack_folder):
                            os.makedirs(nested_pack_folder)
                        zip_ref.extract(name, pack_folder)
                        with zipfile.ZipFile(nested_zip_file_path, 'r') as nested_zip_ref:
                            nested_zip_ref.extractall(nested_pack_folder)
                        os.remove(nested_zip_file_path)
                        extracted_pack_folders.append((os.path.splitext(name)[0], nested_pack_folder))

            os.remove(zip_file_path)
            
            return extracted_pack_folders
        
        except (ConnectionError, Timeout, IncompleteRead) as e:
            print(f"\nFailed to download ZIP file: {e}")
            retry_count += 1
            print(f"Retrying... ({retry_count}/{retries})")
            time.sleep(5)
        
        except zipfile.BadZipFile:
            print("The downloaded file is not a valid ZIP archive.")
            return None
        
        except Exception as e:
            print(f"\nAn error occurred: {e}")
            return None

    print("Exceeded maximum retries. Download failed.")
    return None

def check_for_addon(folder_path):
    manifest_path = os.path.join(folder_path, "manifest.json")
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r') as manifest_file:
            manifest_data = json.load(manifest_file)

        is_manifest_addon = manifest_data.get("metadata", {}).get("product_type") == "addon"
        return is_manifest_addon
    else:
        return False
    
def data_uuid(folder_path):
    manifest_path = os.path.join(folder_path, "manifest.json")
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r') as manifest_file:
            manifest_data = json.load(manifest_file)
            first_uuid = manifest_data.get("header", {}).get("uuid")
        return first_uuid
    return None

def log_error(first_uuid, e):
    error_log_file = 'error_log.txt'
    if first_uuid:
        error_message = f"Error processing pack: {first_uuid} - Error: {str(e)} (please report it)"
    else:
        error_message = f"Error: {str(e)} (please report it)"
    
    print(error_message)
    with open(error_log_file, 'a') as error_file:
        error_file.write(error_message + '\n')

def remove_extracted_folder(extracted_folder):
    parent_folder = os.path.dirname(extracted_folder)
    if os.path.exists(parent_folder):
        print("removing extracted folder...", end="", flush=True)
        shutil.rmtree(parent_folder, ignore_errors=True)
        print("\r" + " " * len("removing extracted folder...") + "\r", end="", flush=True)
        print("extracted folder removed")

def process_custom_ids(result=None, output_folder='packs'):

    is_custom_output = output_folder != 'packs'
    
    if is_custom_output:
        download_output_folder = output_folder
    else:
        temp_dir = tempfile.gettempdir()
        download_output_folder = os.path.join(temp_dir, "dlc_packs")
        os.makedirs(download_output_folder, exist_ok=True)
            
    download_output_folder = os.path.normpath(download_output_folder)
    folders_to_remove = []

    if result is None:
        result = get_custom_id()
        if result == EXIT_COMMAND:
            if is_running_in_termux():
                try:
                    username = subprocess.check_output(['whoami']).decode().strip()
                    subprocess.run(['killall', '-9', '-v', '-g', '-u', username])
                except Exception as e:
                    print(f"Error while attempting to kill processes: {e}")
            return False

    skin_urls = []
    other_urls = []
    preloaded_ids = load_keys_from_files()
    if result:
        if result.get("use_playfab"):
            resultsDict = PlayFab.main(result["ids"])
            for entry in resultsDict.values():
                title = entry.get("Title", {}).get("en-US", "")
                creator_name = entry.get("DisplayProperties", {}).get("creatorName", "")
                for content in entry["Contents"]:
                    if content.get("Type") in {"skinbinary", "personabinary"}:
                        skin_urls.append(content["Url"])
                    elif check_custom_id(result["ids"], preloaded_ids):
                        other_urls.append(content["Url"])
                    else:
                        print(colorama.Fore.RED + f"Key not available for '{title} ( {creator_name} )'" + colorama.Style.RESET_ALL)
        else:
            for item in result["items"]:
                item_id = item.get("Id")
                title = item.get("Title", {}).get("en-US", "")
                creator_name = item.get("DisplayProperties", {}).get("creatorName", "")
                for content in item.get("Contents", []):
                    if content.get("Type") in {"skinbinary", "personabinary"}:
                        skin_urls.append(content["Url"])
                    elif check_custom_id(item_id, preloaded_ids):
                        other_urls.append(content["Url"])
                    else:
                        print(colorama.Fore.RED + f"Key not available for '{title} ( {creator_name} )'" + colorama.Style.RESET_ALL)

    for _, url in enumerate(other_urls + skin_urls):
        extracted_pack_folders = download_and_process_zip(url, download_output_folder)
        if extracted_pack_folders is None:
            continue

        is_skin = url in skin_urls
        if is_skin:
            for _, pack_folder in extracted_pack_folders:
                try:
                    first_uuid = data_uuid(pack_folder)

                    if is_custom_output:
                        skin_output_folder = output_folder
                    else:
                        if is_running_in_pydroid():
                            skin_output_folder = "packs"
                        elif is_running_in_termux():
                            skin_output_folder = "/data/data/com.termux/files/home/storage/downloads/testcoin"
                        else:
                            skin_output_folder = output_folder

                    dlc.skin_main(pack_folder, skin_output_folder)
                    remove_extracted_folder(pack_folder)
                except Exception as e:
                    log_error(first_uuid, e)
        else:
            addon_folders = []
            dlc_folders = []
            for _, pack_folder in extracted_pack_folders:
                is_addon_flag = check_for_addon(pack_folder)
                if is_addon_flag:
                    addon_folders.append(pack_folder)
                else:
                    dlc_folders.append(pack_folder)
                folders_to_remove.append(pack_folder)

            if addon_folders:
                try:
                    first_uuid = data_uuid(pack_folder)

                    if is_custom_output:
                        addon_output_folder = output_folder
                    else:
                        if is_running_in_pydroid():
                            addon_output_folder = "packs"
                        elif is_running_in_termux():
                            addon_output_folder = "/data/data/com.termux/files/home/storage/downloads/testcoin"
                        else:
                            addon_output_folder = output_folder

                    dlc.main(addon_folders, ["keys.tsv", "personal_keys.tsv"], addon_output_folder, is_addon=True)
                except Exception as e:
                    log_error(first_uuid, e)

            if dlc_folders:
                try:
                    first_uuid = data_uuid(pack_folder)

                    if is_custom_output:
                        dlc_output_folder = output_folder
                    else:
                        if is_running_in_pydroid():
                            dlc_output_folder = "packs"
                        elif is_running_in_termux():
                            dlc_output_folder = "/data/data/com.termux/files/home/storage/downloads/testcoin"
                        else:
                            dlc_output_folder = output_folder

                    dlc.main(dlc_folders, ["keys.tsv", "personal_keys.tsv"], dlc_output_folder, is_addon=False)
                except Exception as e:
                    log_error(first_uuid, e)

    for folder in folders_to_remove:
        remove_extracted_folder(folder)

    return True

def parse_arguments():
    parser = argparse.ArgumentParser(description="Process custom IDs and other commands.")
    parser.add_argument("--uuid", type=str, help="UUID(s) or URL(s) containing UUID(s), separated by commas if multiple")
    parser.add_argument("--nodownload", action="store_true", help="Display items without downloading or processing them")
    parser.add_argument("--output", type=str, help="Specify a custom output directory. Defaults to 'packs'.")
    return parser.parse_args()

def process_argument_uuid(uuid_argument):
    ids = []
    for item in uuid_argument.split(','):
        item = item.strip()
        if "id=" in item or "minecraft.net" in item:
            extracted_id = extract_id_from_url(item)
            if extracted_id:
                ids.append(extracted_id)
        elif re.match(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', item):
            ids.append(item)
        else:
            print(f"Invalid UUID or URL: {item}")
    return ids

def main():
    global auth_token
    global global_new_lines

    args = parse_arguments()
    output_folder = args.output if args.output else 'packs'

    try:
        tsv.update_keys()
        global_new_lines, _ = tsv.check_dlc_list()
    except Exception as e:
        log_error(None, e)

    if not login():
        print("Unable to authenticate.")
        return

    if args.uuid:
        ids = process_argument_uuid(args.uuid)
        if ids:
            result = {"ids": ids, "use_playfab": True}
            if args.nodownload:
                items = PlayFab.main(result["ids"])
                filtered_items = [item for item in items.values()]
                display_items(filtered_items)
                return
            else:
                process_custom_ids(result=result, output_folder=output_folder)
        else:
            print("No valid UUIDs found in the provided argument.")
    else:
        while True:
            if not process_custom_ids():
                break

if __name__ == "__main__":
    main()