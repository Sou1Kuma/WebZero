// ███████╗███████╗██████╗  ██████╗ ████████╗██╗    ██╗ ██████╗ 
// ╚══███╔╝██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝██║    ██║██╔═══██╗
//   ███╔╝ █████╗  ██████╔╝██║   ██║   ██║   ██║ █╗ ██║██║   ██║
//  ███╔╝  ██╔══╝  ██╔══██╗██║   ██║   ██║   ██║███╗██║██║   ██║
// ███████╗███████╗██║  ██║╚██████╔╝   ██║   ╚███╔███╔╝╚██████╔╝
// ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚══╝╚══╝  ╚═════╝ 
//
// This project was created for the Minecraft community, thanks to Lisa for creating this website and Bluecoin Community for giving us permissions <3

import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ItemCard from './ItemCard';
import ReactDOM from 'react-dom';
import LoginForm from './LoginForm';

interface SearchResult {
  Id: string;
  Title: { 'en-US': string };
  DisplayProperties: { creatorName: string };
  ContentType: string[];
  Tags: string[];
  source?: string;
  Images?: Array<{
    Id: string;
    Tag: string;
    Type: string;
    Url: string;
  }>;
}

interface DownloadItem {
  id: string;
  title: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number;
  totalSize: number;
  downloadedSize: number;
  speed: number;
  startTime: number;
  serverStatus?: string;
  contentTypes?: string;
  hasMultipleTypes?: boolean;
  totalFiles?: string;
}

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// API config
const API_BASE = "https://apizero.onrender.com";

// Utility functions for download display
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatSpeed = (bytesPerSecond: number): string => {
  return formatBytes(bytesPerSecond) + '/s';
};

function BrowsePage({ handleDownload, downloads, renderDownloadsPanel }: {
  handleDownload: (itemId: string, title: string) => void;
  downloads: DownloadItem[];
  renderDownloadsPanel: () => JSX.Element;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [total, setTotal] = useState(0);
  const pageSize = 12;
  const tags = [
    { label: 'All', value: 'all' },
    { label: 'Add-Ons', value: 'addon' },
    { label: 'Worlds', value: 'worlds' },
    { label: 'Mashups', value: 'mashup' },
    { label: 'Textures', value: 'texturepack' },
    { label: 'Skins', value: 'skinpack' },
  ];
  const [sort, setSort] = useState<'created' | 'updated'>('created');

  // State for modal
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [modalImages, setModalImages] = useState<Array<{ Tag: string; Url: string }> | null>(null);
  const [modalVideos, setModalVideos] = useState<Array<{ Tag: string; Url: string }> | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const galleryRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    let url: string;
    let headers: any = {
      'Cache-Control': 'no-cache'
    };

    // ถ้าเลือก tag skinpack ให้ใช้ API หลัก (api.py)
    if (selectedTag === 'skinpack') {
      url = `${API_BASE}/api/browse-skinpack?page=${page}&page_size=${pageSize}`;
      if (debouncedSearch.trim()) {
        url += `&search=${encodeURIComponent(debouncedSearch.trim())}`;
      }
      headers['Authorization'] = 'Bearer zerotwo';
    } else {
      url = `${API_BASE}/api/browse-local?page=${page}&page_size=${pageSize}&content_type=${selectedTag}&_=${Date.now()}`;
      if (debouncedSearch.trim()) {
        url += `&search=${encodeURIComponent(debouncedSearch.trim())}`;
      }
      headers['Authorization'] = 'Bearer zerotwo';
    }

    // For /api/browse, add sort param
    if (selectedTag !== 'skinpack' && selectedTag !== 'all') {
      url = `${API_BASE}/api/browse?page=${page}&page_size=${pageSize}&content_type=${selectedTag}&sort=${sort}`;
      if (debouncedSearch.trim()) {
        url += `&search=${encodeURIComponent(debouncedSearch.trim())}`;
      }
      headers['Authorization'] = 'Bearer zerotwo';
    }

    fetch(url, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('API error: ' + res.status);
        return res.json();
      })
      .then((data) => {
        const items = (data.data || data.items || []).map((item: any) => ({
          ...item,
          hasMultipleTypes: item.hasMultipleTypes ?? item['hasMultipleTypes'] ?? item['X-Has-Multiple-Types'] === 'true',
          totalFiles: item.totalFiles ?? item['totalFiles'] ?? item['X-Total-Files'] ?? 1,
        }));
        console.log('API items:', items.length, items);
        // Enrich items with PlayFab images (เฉพาะถ้ายังไม่มี Images)
        if (items.length > 0 && !items[0].Images) {
          const itemIds = items.map((item: any) => item.Id || item.id).filter(Boolean);
          if (itemIds.length > 0) {
            fetch(`${API_BASE}/api/enrich-images`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer zerotwo'
              },
              body: JSON.stringify({ item_ids: itemIds })
            })
            .then(res => res.json())
            .then(imageData => {
              const enrichedItems = items.map((item: any) => {
                const itemId = item.Id || item.id;
                if (imageData[itemId] && imageData[itemId].Images) {
                  return { ...item, Images: imageData[itemId].Images };
                }
                return item;
              });
              console.log('Enriched items:', enrichedItems.length, enrichedItems);
              setItems(enrichedItems);
            })
            .catch(err => {
              setItems(items);
            });
          } else {
            setItems(items);
          }
        } else {
          setItems(items);
        }
        setTotal(data.total || data.count || (data.data ? data.data.length : 0));
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        setItems([]);
        setTotal(0);
      });
  }, [selectedTag, page, debouncedSearch, sort]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Fetch all images/videos for modal when selectedItem changes
  useEffect(() => {
    if (!selectedItem) {
      setModalImages(null);
      setModalVideos(null);
      setModalLoading(false);
      setSelectedImage(null);
      return;
    }
    setModalLoading(true);
    fetch(`${API_BASE}/api/enrich-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer zerotwo'
      },
      body: JSON.stringify({ item_ids: [selectedItem.Id || selectedItem.id] })
    })
      .then(res => res.json())
      .then(imageData => {
        const images = imageData[selectedItem.Id || selectedItem.id]?.Images || [];
        const galleryImages = images.filter((img: any) => img.Tag === 'Thumbnail' || img.Tag === 'screenshot');
        
        // Sort images: Thumbnail first, then screenshots
        const sortedImages = galleryImages.sort((a: any, b: any) => {
          if (a.Tag === 'Thumbnail' && b.Tag !== 'Thumbnail') return -1;
          if (a.Tag !== 'Thumbnail' && b.Tag === 'Thumbnail') return 1;
          return 0;
        });
        
        setModalImages(sortedImages);
        setModalVideos(images.filter((img: any) => img.Tag.toLowerCase().includes('video') || img.Tag.toLowerCase().includes('trailer')));
        setSelectedImage(sortedImages[0]?.Url || null);
        setModalLoading(false);
      })
      .catch(() => {
        setModalImages(null);
        setModalVideos(null);
        setSelectedImage(null);
        setModalLoading(false);
      });
  }, [selectedItem]);

  useEffect(() => {
    if (galleryRef.current) {
      galleryRef.current.scrollLeft = 0;
    }
  }, [selectedItem]);

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lock scroll when modal is open
  useEffect(() => {
    if (selectedItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedItem]);

  return (
    <div className="browse-page" style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <h2 style={{ color: '#ffd600', fontWeight: 'bold', fontSize: 32, textAlign: 'center', marginBottom: 24 }}>Browse Marketplace</h2>
      {/* ช่องค้นหาใหม่ (เด่นขึ้น อยู่บนสุด) */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ position: 'relative', width: 400 }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#b6eaff', fontSize: 22, pointerEvents: 'none', zIndex: 2 }}>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search content in marketplace..."
            style={{
              width: '100%',
              padding: '14px 16px 14px 48px',
              fontSize: 20,
              borderRadius: 12,
              border: '2px solid #ffd600',
              boxShadow: '0 2px 12px #ffd60033',
              outline: 'none',
              color: '#a85fff',
              background: '#181818',
              marginBottom: 0
            }}
            onKeyDown={e => { if (e.key === 'Enter') setDebouncedSearch(search); }}
          />
        </div>
      </div>
      {/* เดิม: filter/sort bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <label style={{ color: '#ffd600', fontWeight: 'bold', marginRight: 8 }}>Sort by:</label>
        <select value={sort} onChange={e => setSort(e.target.value as 'created' | 'updated')} style={{ fontSize: 16, borderRadius: 6, padding: '4px 12px' }}>
          <option value="created">Latest Created</option>
          <option value="updated">Latest Updated</option>
        </select>
      </div>
      {/* Drawer button for mobile */}
      <button
        className="filter-drawer-btn"
        onClick={() => setDrawerOpen(true)}
        style={{
          display: 'none',
          position: 'fixed',
          top: 24,
          left: 24,
          zIndex: 1200,
          background: '#ffd600',
          color: '#222',
          border: 'none',
          borderRadius: 8,
          padding: '10px 24px',
          fontWeight: 'bold',
          fontSize: 18,
          boxShadow: '0 2px 8px #0004',
          cursor: 'pointer',
        }}
      >Filter</button>
      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="filter-drawer-overlay" onClick={() => setDrawerOpen(false)}></div>
      )}
      {/* Drawer itself */}
      <div className={`filter-drawer${drawerOpen ? ' open' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 24 }}>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: '#ffd600', fontSize: 28, cursor: 'pointer', marginBottom: 8 }}
          >×</button>
          <div style={{ fontWeight: 'bold', marginBottom: 12, color: '#ffd600' }}>Filter by Tag</div>
          {tags.map((tag) => (
            <button
              key={tag.value}
              className={selectedTag === tag.value ? 'browse-btn selected' : 'browse-btn'}
              onClick={() => { setSelectedTag(tag.value); setPage(1); setDrawerOpen(false); }}
              style={{ fontWeight: selectedTag === tag.value ? 'bold' : undefined }}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>
      <div className="browse-content" style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        {/* Desktop filter (hidden on mobile) */}
        <div className="filter-sidebar">
          <div style={{ fontWeight: 'bold', marginBottom: 12, color: '#ffd600' }}>Filter by Tag</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tags.map((tag) => (
              <button
                key={tag.value}
                className={selectedTag === tag.value ? 'browse-btn selected' : 'browse-btn'}
                onClick={() => { setSelectedTag(tag.value); setPage(1); }}
                style={{ fontWeight: selectedTag === tag.value ? 'bold' : undefined }}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', marginBottom: 18, gap: 12 }}>
            {/* ช่องค้นหาเดิม ลบออก เพราะย้ายไปด้านบนแล้ว */}
            {/* <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search for content..."
              style={{ width: 320, padding: 8, fontSize: 16, borderRadius: 6, border: '1px solid #888' }}
            /> */}
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#ffd600', fontSize: 20, marginTop: 40 }}>Loading...</div>
          ) : (
            <>
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#ffd600', fontSize: 20, marginTop: 40 }}>No items found.</div>
              ) : (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 24,
                    marginTop: 8
                  }}>
                    {items.map((item, idx) => {
                      const downloadItem = downloads.find(d => d.id.startsWith((item.Id || item.id) + '_'));
                      const isPending = downloadItem?.status === 'pending';
                      const isDownloading = downloadItem?.status === 'downloading';
                      return (
                        <ItemCard
                          key={item.Id || item.id || idx}
                          item={item}
                          index={idx}
                          onSelect={setSelectedItem}
                        />
                      );
                    })}
                  </div>
                  {/* pagination */}
                  <div className="browse-pagination" style={{ marginTop: 24, textAlign: 'center' }}>
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
                    <span style={{ marginLeft: 12, color: '#ffd600', fontWeight: 'bold' }}>Page {page} / {totalPages}</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal for details */}
      {selectedItem && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setSelectedItem(null)}
        >
          <div
            style={{
              background: '#181818',
              borderRadius: 16,
              padding: 24,
              minWidth: 320,
              maxWidth: 700,
              width: '95vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 4px 32px #000a',
              margin: 0,
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedItem(null)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                color: '#ffd600',
                fontSize: 28,
                cursor: 'pointer',
                zIndex: 10
              }}
            >×</button>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              {/* Main image (selected) */}
              <img
                src={selectedImage || '/placeholder.png'}
                alt="main"
                style={{ width: '100%', maxWidth: 600, borderRadius: 10, boxShadow: '0 2px 8px #0004', background: '#111', margin: '0 auto', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
              />
            </div>
            {/* Gallery of screenshots */}
            {modalLoading ? (
              <div style={{ color: '#ffd600', textAlign: 'center', marginBottom: 12 }}>Loading images...</div>
            ) : modalImages && modalImages.length > 1 ? (
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <div
                  ref={galleryRef}
                  className="gallery-thumbnails"
                >
                  {modalImages.map((img, i) => (
                    <img
                      key={i}
                      src={img.Url}
                      alt={img.Tag}
                      style={{
                        boxShadow: selectedImage === img.Url ? '0 0 0 3px #ffd700' : '0 1px 4px #0006',
                        background: '#111',
                        cursor: 'pointer',
                        border: selectedImage === img.Url ? '2px solid #ffd700' : 'none'
                      }}
                      onClick={() => setSelectedImage(img.Url)}
                      onError={e => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
                    />
                  ))}
                </div>
                {/* Navigation buttons */}
                {modalImages.length > 4 && (
                  <>
                    <button
                      onClick={() => {
                        if (galleryRef.current) {
                          galleryRef.current.scrollLeft -= 320;
                        }
                      }}
                      className="gallery-nav-btn prev"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => {
                        if (galleryRef.current) {
                          galleryRef.current.scrollLeft += 320;
                        }
                      }}
                      className="gallery-nav-btn next"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
            ) : null}
            {/* Video player or button */}
            {modalVideos && modalVideos.length > 0 && (
              <div style={{ marginBottom: 12, textAlign: 'center' }}>
                {modalVideos.map((vid, i) => (
                  <video key={i} controls style={{ width: '100%', maxWidth: 320, borderRadius: 8, marginBottom: 8 }}>
                    <source src={vid.Url} />
                    Your browser does not support the video tag.
                  </video>
                ))}
                      </div>
                    )}
            <div style={{ fontWeight: 'bold', fontSize: 22, color: '#ffd600', textAlign: 'center', marginBottom: 8 }}>
              {selectedItem.Title?.['en-US'] || selectedItem.name || selectedItem.title}
                    </div>
            <div style={{ color: '#ccc', fontSize: 16, marginBottom: 4, textAlign: 'center' }}>
              by {selectedItem.DisplayProperties?.creatorName || 'Unknown'}
                    </div>
            <div style={{ color: '#aaa', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
              ID: {selectedItem.Id || selectedItem.id}
                    </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
              {(() => {
                const tags = selectedItem.Tags || [];
                const skinpackTags = tags.filter((tag: string) => tag.toLowerCase() === 'skinpack');
                return skinpackTags.map((tag: string, i: number) => (
                  <span key={i} style={{
                    background: '#ffd600',
                    color: '#222',
                    borderRadius: 4,
                    padding: '4px 10px',
                    fontWeight: 'bold',
                    fontSize: 14
                  }}>{tag}</span>
                ));
              })()}
            </div>
            {/* Download section */}
            {(() => {
              const downloadItem = downloads.find(d => d.id.startsWith((selectedItem.Id || selectedItem.id) + '_'));
              const isPending = downloadItem?.status === 'pending';
              const isDownloading = downloadItem?.status === 'downloading';
              // Show notice if multiple files (check both downloadItem and selectedItem)
              const hasMultipleFiles =
                (downloadItem?.hasMultipleTypes || (downloadItem?.totalFiles && Number(downloadItem.totalFiles) > 1)) ||
                (selectedItem?.hasMultipleTypes || (selectedItem?.totalFiles && Number(selectedItem.totalFiles) > 1));
              return (
                <div style={{ marginTop: 16 }}>
                  {hasMultipleFiles && (
                    <>
                      <div style={{ color: '#ffd600', background: '#333', borderRadius: 8, padding: '8px 16px', marginBottom: 12, textAlign: 'center', fontWeight: 'bold' }}>
                        This content contains multiple files. You will receive a .zip archive.
                      </div>
                      <div style={{ color: '#ffd600', background: 'none', fontSize: 15, textAlign: 'center', marginBottom: 12 }}>
                        After downloading, please extract the <b>.zip</b> file to access all included packs (such as worlds, skins, or add-ons).
                      </div>
                    </>
                  )}
                  {/* Download progress */}
                  {downloadItem && (
                    <div style={{ marginBottom: 12 }}>
                      <div className="download-progress" style={{ marginBottom: 8 }}>
                        <div className="progress-bar" style={{ height: 12, background: '#333', borderRadius: 6 }}>
                          <div
                            className="progress-fill"
                            style={{
                              width: `${downloadItem.progress}%`,
                              background: downloadItem.status === 'completed' ? '#4caf50' : '#ffd600',
                              height: 12,
                              borderRadius: 6,
                              transition: 'width 0.2s'
                            }}
                          ></div>
                        </div>
                        <div className="progress-text" style={{ color: '#ffd600', fontSize: 14, marginTop: 4, textAlign: 'center' }}>
                          {downloadItem.status === 'pending' ? 'Preparing download...' :
                            downloadItem.totalSize > 0 ? `${downloadItem.progress.toFixed(1)}%` :
                              downloadItem.downloadedSize > 0 ? 'Downloading...' : '0%'}
                        </div>
                      </div>
                      <div className="download-stats" style={{ color: '#aaa', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
                        {downloadItem.status === 'pending' ? (
                          <span className="server-status">
                            {downloadItem.serverStatus || 'Server fetching content...'}
                          </span>
                        ) : (
                          <>
                            <span className="download-size">
                              {downloadItem.totalSize > 0 ?
                                `${formatBytes(downloadItem.downloadedSize)} / ${formatBytes(downloadItem.totalSize)}` :
                                downloadItem.downloadedSize > 0 ?
                                  `${formatBytes(downloadItem.downloadedSize)} downloaded` :
                                  'Preparing...'
                              }
                            </span>
                            {downloadItem.status === 'downloading' && downloadItem.speed > 0 && (
                              <span className="download-speed" style={{ marginLeft: 8 }}>
                                {formatSpeed(downloadItem.speed)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Download button */}
                  {(selectedItem.canDownload || (selectedItem.Tags && selectedItem.Tags.map((t: string) => t.toLowerCase()).includes('skinpack'))) && (
                  <button
                    onClick={() => {
                      handleDownload(selectedItem.Id || selectedItem.id, selectedItem.Title?.['en-US'] || selectedItem.name || selectedItem.title || 'Unknown Title');
                    }}
                    disabled={isPending || isDownloading}
                    style={{
                      background: '#ffd600',
                      color: '#222',
                      fontWeight: 'bold',
                      fontSize: 18,
                      border: 'none',
                      borderRadius: 8,
                      padding: '12px 48px',
                      margin: '0 auto',
                      display: 'block',
                      cursor: isPending || isDownloading ? 'not-allowed' : 'pointer',
                      opacity: isPending || isDownloading ? 0.7 : 1,
                      boxShadow: '0 2px 8px #0004',
                      transition: 'all 0.2s ease',
                      width: '100%',
                      maxWidth: 300
                    }}
                  >
                    {isPending ? 'Preparing...' :
                     isDownloading ? 'Downloading...' :
                     'Download'}
                  </button>
                  )}
                </div>
              );
            })()}
                    </div>
                  </div>
      , document.body)}
    </div>
  );
}

// NavigationBar component
function NavigationBar({ onShowCredits, user, onLogout }: { onShowCredits: () => void, user: any, onLogout: () => void }) {
  return (
    <nav style={{
      position: 'relative',
      zIndex: 10,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '2rem',
      marginTop: '1.5rem',
    }}>
      <Link to="/" style={{ color: '#FFD600', fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>Home</Link>
      <Link to="/search" style={{ color: '#FFD600', fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>Search</Link>
      <Link to="/browse" style={{ color: '#FFD600', fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>Browse</Link>
      {user && user.role === 'admin' && (
        <Link to="/aboutme" style={{ color: '#FFD600', fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>เกี่ยวกับฉัน</Link>
      )}
      {user && (
        <Link to="/profile" style={{ color: '#FFD600', fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>โปรไฟล์</Link>
      )}
      <button onClick={onShowCredits} style={{
        background: '#ffd600',
        color: '#222',
        border: 'none',
        borderRadius: 6,
        padding: '0.3rem 1.2rem',
        fontWeight: 600,
        fontSize: 16,
        cursor: 'pointer',
        boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)',
        transition: 'background 0.2s',
        zIndex: 10,
      }}>Credits</button>
      <button onClick={onLogout} style={{
        marginLeft: '2rem',
        background: '#ff4d4f',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        padding: '0.3rem 1.2rem',
        fontWeight: 600,
        fontSize: 16,
        cursor: 'pointer',
        boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)',
        transition: 'background 0.2s',
        zIndex: 10,
      }}>Logout</button>
    </nav>
  );
}

// HomePage component
function HomePage() {
  return (
    <div className="centered-page" style={{ textAlign: 'center', marginTop: 40 }}>
      <h1 style={{ color: '#ffd600', fontSize: 40, fontWeight: 'bold' }}>Welcome to Zero Marketplace</h1>
      <p style={{ color: '#ccc', fontSize: 20, marginTop: 24 }}>
        Browse, search, and download Minecraft Marketplace content easily!<br />
        <span style={{ color: '#ffd600', fontWeight: 600 }}>Features:</span>
        <ul style={{ color: '#fff', fontSize: 18, margin: '18px auto', maxWidth: 500, textAlign: 'left', lineHeight: 1.7 }}>
          <li>🔍 ค้นหา Marketplace ด้วยชื่อ, UUID, หรือ URL</li>
          <li>📦 ดาวน์โหลด Add-ons, Worlds, Skins, Texturepacks</li>
          <li>⚡ ระบบดาวน์โหลดเร็ว รองรับหลายไฟล์ (.zip)</li>
          <li>🖼️ แสดงภาพตัวอย่างและวิดีโอ</li>
          <li>🔒 ระบบล็อกอิน/สมัครสมาชิก</li>
        </ul>
        <Link to="/browse" style={{ background: '#ffd600', color: '#222', fontWeight: 'bold', fontSize: 20, borderRadius: 8, padding: '12px 36px', textDecoration: 'none', boxShadow: '0 2px 8px #0004', marginTop: 18, display: 'inline-block' }}>Browse Now</Link>
      </p>
    </div>
  );
}

// SearchPage component (moved search logic/UI here)
function SearchPage({ handleDownload, downloads }: { handleDownload: (itemId: string, title: string) => void, downloads: any[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noResultsError, setNoResultsError] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    setNoResultsError('');
    setResults([]);
    try {
      const apiUrl = `${API_BASE}/api/search`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer zerotwo'
        },
        body: JSON.stringify({
          query: searchQuery,
          search_type: 'name',
          limit: 50
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        const searchResults = data.data || [];
        setResults(searchResults);
        if (searchResults.length === 0) {
          setNoResultsError(`No results found for "${searchQuery}". Please try a different search term.`);
          setTimeout(() => { setNoResultsError(''); }, 3000);
        }
      } else {
        setError('Search failed. Please try again.');
      }
    } catch (err) {
      setError('Failed to search. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="search-modern-bg" style={{ minHeight: '100vh', padding: '40px 0', background: 'transparent' }}>
      <div className="centered-page" style={{ maxWidth: 800, width: '100%', margin: '0 auto' }}>
        <h2 style={{ color: '#a85fff', fontWeight: 'bold', fontSize: 40, textAlign: 'center', marginBottom: 18, letterSpacing: 1 }}>Search Marketplace</h2>
        <div className="search-card" style={{ background: 'rgba(255,255,255,0.65)', boxShadow: '0 4px 24px #ffe3fa', borderRadius: 18, padding: 32, marginBottom: 18, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="search-container" style={{ display: 'flex', gap: 0, alignItems: 'center', width: '100%', maxWidth: 420, background: 'white', borderRadius: 12, boxShadow: '0 2px 8px #ffe3fa', padding: '0 0 0 12px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 18, color: '#b6eaff', fontSize: 22, pointerEvents: 'none', zIndex: 2 }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter NAME, UUID or URL"
              className="search-input"
              disabled={loading}
              style={{ padding: '12px 16px 12px 44px', fontSize: 18, borderRadius: 12, border: '2px solid #b6eaff', width: 320, background: 'transparent', color: '#a85fff', outline: 'none', boxShadow: 'none' }}
            />
            <button
              onClick={handleSearch}
              className="search-button"
              disabled={loading || !searchQuery.trim()}
              style={{ background: 'linear-gradient(90deg, #ffb6e6 0%, #b6eaff 100%)', color: '#a85fff', fontWeight: 'bold', fontSize: 18, border: 'none', borderRadius: '0 12px 12px 0', padding: '12px 32px', cursor: loading ? 'not-allowed' : 'pointer', marginLeft: -2, height: 48 }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          <div style={{ color: '#b6eaff', fontSize: 15, marginTop: 10, textAlign: 'center' }}>
            Tip: You can search by <span style={{ color: '#a85fff', fontWeight: 600 }}>name</span>, <span style={{ color: '#a85fff', fontWeight: 600 }}>UUID</span>, or <span style={{ color: '#a85fff', fontWeight: 600 }}>Marketplace URL</span>.
          </div>
        </div>
        {error && <div className="error-message" style={{ color: 'white', background: '#ff4444', textAlign: 'center', marginBottom: 12 }}>{error}</div>}
        {noResultsError && <div className="no-results-error" style={{ color: 'white', background: '#ff9800', textAlign: 'center', marginBottom: 12 }}>{noResultsError}</div>}
        {results.length > 0 && (
          <div className="results-container search-results-fadein" style={{ boxShadow: '0 4px 32px #ffe3fa', borderRadius: 18, background: 'rgba(255,255,255,0.65)', padding: '32px 18px', marginTop: 32 }}>
            <h3 style={{ color: '#a85fff', textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 24, letterSpacing: 1 }}>Search Results ({results.length})</h3>
            <div className="results-list">
              {results.map((result, index) => (
                <ItemCard key={result.Id} item={result} index={index} onDownload={handleDownload} downloads={downloads} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// เพิ่มวิดีโอพื้นหลัง anime
function BackgroundVideo() {
  return (
    <video className="background-video" autoPlay loop muted playsInline>
      <source src="/zerotwo.mp4" type="video/mp4" />
    </video>
  );
}

function AuthDemo() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'register') {
        const res = await fetch(`${API_BASE}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (!res.ok) throw new Error((await res.json()).detail || 'Register failed');
        alert('Register success! Please login.');
        setMode('login');
      } else {
        const res = await fetch(`${API_BASE}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (!res.ok) throw new Error((await res.json()).detail || 'Login failed');
        const data = await res.json();
        setToken(data.access_token);
        localStorage.setItem('token', data.access_token);
        fetchMe(data.access_token);
      }
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMe = async (tk?: string) => {
    const accessToken = tk || token;
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error('Failed to fetch user');
      setUser(await res.json());
    } catch {
      setUser(null);
    }
  };

  React.useEffect(() => {
    if (token && !user) fetchMe();
  }, [token]);

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  if (token && user) {
    return (
      <div style={{ maxWidth: 400, margin: '2rem auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>Welcome, {user.username}</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 8 }}>
          {loading ? 'Loading...' : mode === 'login' ? 'Login' : 'Register'}
        </button>
      </form>
      <div style={{ marginTop: 16 }}>
        {mode === 'login' ? (
          <span>Don't have an account? <button onClick={() => setMode('register')}>Register</button></span>
        ) : (
          <span>Already have an account? <button onClick={() => setMode('login')}>Login</button></span>
        )}
      </div>
    </div>
  );
}

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noResultsError, setNoResultsError] = useState('');
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDownloadPanelOpen, setIsDownloadPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showCredits, setShowCredits] = useState(false);
  
  // Authentication states
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/health`, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer zerotwo'
          },
          signal: AbortSignal.timeout(5000)
        });

        const status = response.ok ? 'Online and Detected' : 'Detected but Error';
        const environment = API_BASE.includes('localhost') ? 'Local' : 'Production';

        console.log(`
███████╗███████╗██████╗  ██████╗ ████████╗██╗    ██╗ ██████╗ 
╚══███╔╝██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝██║    ██║██╔═══██╗
  ███╔╝ █████╗  ██████╔╝██║   ██║   ██║   ██║ █╗ ██║██║   ██║
 ███╔╝  ██╔══╝  ██╔══██╗██║   ██║   ██║   ██║███╗██║██║   ██║
███████╗███████╗██║  ██║╚██████╔╝   ██║   ╚███╔███╔╝╚██████╔╝
╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚══╝╚══╝  ╚═════╝ 

ZerotwoAPI v0.2 - ${status} (${environment})
Minecraft Marketplace Content Platform
`);
      } catch (error) {
        const environment = API_BASE.includes('localhost') ? 'Local' : 'Production';

        console.log(`
███████╗███████╗██████╗  ██████╗ ████████╗██╗    ██╗ ██████╗ 
╚══███╔╝██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝██║    ██║██╔═══██╗
  ███╔╝ █████╗  ██████╔╝██║   ██║   ██║   ██║ █╗ ██║██║   ██║
 ███╔╝  ██╔══╝  ██╔══██╗██║   ██║   ██║   ██║███╗██║██║   ██║
███████╗███████╗██║  ██║╚██████╔╝   ██║   ╚███╔███╔╝╚██████╔╝
╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚══╝╚══╝  ╚═════╝ 

ZerotwoAPI v0.2 - Not Detected (${environment})
Minecraft Marketplace Content Platform
`);
      }
    };

    checkApiStatus();

    const timer = setTimeout(() => {
      // setIsInitialLoad(false); // This line was removed as per the edit hint
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Check authentication on mount
  useEffect(() => {
    if (token && !user) {
      fetchMe();
    }
  }, [token]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');
    setNoResultsError('');
    setResults([]);

    try {
      const apiUrl = `${API_BASE}/api/search`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer zerotwo'
        },
        body: JSON.stringify({
          query: searchQuery,
          search_type: 'name',
          limit: 50
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const searchResults = data.data || [];
        setResults(searchResults);

        if (searchResults.length === 0) {
          setNoResultsError(`No results found for "${searchQuery}". Please try a different search term.`);
          setTimeout(() => {
            setNoResultsError('');
          }, 3000);
        }

        if (data.source && data.source.includes('local')) {
          console.log('Using local data source for faster results');
        }
      } else {
        setError('Search failed. Please try again.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const addNotification = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now().toString();
    const notification: Notification = { id, message, type };
    setNotifications(prev => [...prev, notification]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const handleDownload = async (itemId: string, title: string) => {
    addNotification(`Starting download: ${title}`, 'info');
    const uniqueDownloadId = `${itemId}_${Date.now()}`;
    const downloadItem: DownloadItem = {
      id: uniqueDownloadId,
      title,
      status: 'pending',
      progress: 0,
      totalSize: 0,
      downloadedSize: 0,
      speed: 0,
      startTime: Date.now(),
      serverStatus: 'Server fetching content...'
    };
    setDownloads(prev => [...prev, downloadItem]);
    const serverStatusTimeout = setTimeout(() => {
      setDownloads(prev => prev.map(d =>
        d.id === uniqueDownloadId && d.status === 'pending' ? {
          ...d,
          serverStatus: 'Server processing... This may take a moment.'
        } : d
      ));
    }, 3000);
    try {
      const apiUrl = `${API_BASE}/api/download`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer zerotwo'
        },
        body: JSON.stringify({
          item_id: itemId,
          process_content: true
        })
      });
      if (!response.ok) {
        let errorMessage = `Download failed: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail && typeof errorData.detail === 'object') {
            if (errorData.detail.error === 'missing_decryption_keys') {
              errorMessage = `🔐 Missing Decryption Keys: ${errorData.detail.message}`;
              addNotification(errorMessage, 'error');
              setDownloads(prev => prev.filter(d => d.id !== uniqueDownloadId));
              return;
            } else {
              errorMessage = errorData.detail.message || errorData.detail;
            }
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (parseError) {}
        throw new Error(errorMessage);
      }
      const contentLength = response.headers.get('content-length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      const contentTypes = response.headers.get('x-content-types') || 'Content Pack';
      const hasMultipleTypes = response.headers.get('x-has-multiple-types') === 'true';
      const totalFiles = response.headers.get('x-total-files') || '1';
      const isProcessed = response.headers.get('x-processed') === 'true';
      clearTimeout(serverStatusTimeout);
      setDownloads(prev => prev.map(d =>
        d.id === uniqueDownloadId ? {
          ...d,
          totalSize,
          contentTypes: isProcessed ? `${contentTypes} (Processed)` : contentTypes,
          hasMultipleTypes,
          totalFiles,
          status: 'downloading',
          serverStatus: undefined
        } : d
      ));
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${title.replace(/[^a-z0-9]/gi, '_')}.mcpack`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+?)"/);
        if (match) filename = match[1];
      }
      // 🔍 DEBUG LOG
      console.log('contentDisposition:', contentDisposition);
      console.log('filename:', filename);
      console.log('contentTypes:', contentTypes);
      // --- Remove the block that changes .zip to .mcpack/.mcaddon/.mctemplate ---
      // if (filename.endsWith('.zip')) {
      //   const normalizedType = contentTypes.toLowerCase().replace(/[  -\s\-_]/g, '');
      //   let ext = '.mcpack';
      //   if (normalizedType.includes('addon')) ext = '.mcaddon';
      //   else if (normalizedType.includes('template')) ext = '.mctemplate';
      //   else if (normalizedType.includes('skinpack')) ext = '.mcpack';
      //   else if (normalizedType.includes('texture')) ext = '.mcpack';
      //   filename = filename.replace(/\.zip$/, ext);
      // }
      // --- Always use the filename from backend ---
  
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let downloadedSize = 0;
      const startTime = Date.now();
      if (!reader) {
        throw new Error('Response body is not readable');
      }
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;
        chunks.push(value);
        downloadedSize += value.length;
        const currentTime = Date.now();
        const elapsedTime = (currentTime - startTime) / 1000;
        const speed = elapsedTime > 0 ? downloadedSize / elapsedTime : 0;
        const progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;
        const safeDownloadedSize = downloadedSize;
        setDownloads(prev => prev.map(d =>
          d.id === uniqueDownloadId ? {
            ...d,
            downloadedSize: safeDownloadedSize,
            progress: Math.min(progress, 100),
            speed
          } : d
        ));
      }
      // ใช้ type จาก header ถ้าเป็น .mcpack/.mcaddon/.mctemplate ให้เป็น octet-stream
      let blobType = 'application/zip';
      if (filename.endsWith('.mcpack') || filename.endsWith('.mcaddon') || filename.endsWith('.mctemplate')) {
        blobType = 'application/octet-stream';
      }
      const blob = new Blob(chunks, { type: blobType });
      if (blob.size === 0) throw new Error('Downloaded file is empty - no data received from server');
      if (!window.URL || !window.URL.createObjectURL) throw new Error('Browser does not support file downloads');
      try {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        addNotification(`Saving ${filename} to device...`, 'info');
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
        }, 1000);
      } catch (downloadError) {
        addNotification('Unable to save file to device. Please check browser permissions.', 'error');
      }
      setDownloads(prev => prev.map(d =>
        d.id === uniqueDownloadId ? { ...d, status: 'completed', progress: 100 } : d
      ));
      addNotification(`Download completed: ${title}`, 'success');
      setTimeout(() => {
        setDownloads(prev => prev.filter(d => d.id !== uniqueDownloadId));
      }, 10000);
    } catch (err) {
      setDownloads(prev => prev.map(d =>
        d.id === uniqueDownloadId ? { ...d, status: 'error' } : d
      ));
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      addNotification(`Download failed: ${errorMessage}`, 'error');
      setTimeout(() => {
        setDownloads(prev => prev.filter(d => d.id !== uniqueDownloadId));
      }, 5000);
    }
  };

  const renderDownloadsPanel = (isMobile = false) => (
    <div style={isMobile ? {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '60vh',
      background: '#222',
      color: '#ffd600',
      zIndex: 1200,
      borderRadius: '16px 16px 0 0',
      boxShadow: '0 -2px 16px #000a',
      transition: 'transform 0.3s',
      transform: isDownloadPanelOpen ? 'translateY(0)' : 'translateY(100%)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    } : {
      position: 'fixed',
      top: 0,
      right: isDownloadPanelOpen ? 0 : -320,
      width: 320,
      height: '100vh',
      background: '#222',
      color: '#ffd600',
      zIndex: 1200,
      boxShadow: '-2px 0 8px #0004',
      transition: 'right 0.3s',
      overflow: 'hidden',
    }}>
      <div className="downloads-header" style={isMobile ? {padding: '16px 24px 8px', borderBottom: '1px solid #333', fontSize: 20, fontWeight: 'bold'} : {}}>
        <h3 style={{margin: 0}}>Downloads</h3>
        <button
          className="close-panel-btn"
          onClick={() => setIsDownloadPanelOpen(false)}
          style={isMobile ? {position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: '#ffd600', fontSize: 28, cursor: 'pointer'} : {}}
        >✕</button>
      </div>
      <div className="downloads-content" style={isMobile ? {flex: 1, overflowY: 'auto', padding: 16} : {}}>
        {downloads.length === 0 ? (
          <div className="no-downloads">No active downloads</div>
        ) : (
          downloads.map((download) => (
            <div key={download.id} className={`download-item ${download.status}`}>
              <div className="download-info">
                <div className="download-title">{download.title}</div>
                {download.contentTypes && (
                  <div className="download-content-type">
                    {download.contentTypes}
                    {download.hasMultipleTypes && download.totalFiles && (
                      <span className="file-count"> ({download.totalFiles} files)</span>
                    )}
                  </div>
                )}
                <div className="download-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${download.progress}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    {download.status === 'pending' ? 'Pending...' :
                     download.totalSize > 0 ? `${download.progress.toFixed(1)}%` :
                     download.downloadedSize > 0 ? 'Downloading...' : '0%'}
                  </div>
                </div>
                <div className="download-stats">
                  {download.status === 'pending' ? (
                    <span className="server-status">
                      {download.serverStatus || 'Preparing download...'}
                    </span>
                  ) : (
                    <>
                      <span className="download-size">
                        {download.totalSize > 0 ?
                          `${formatBytes(download.downloadedSize)} / ${formatBytes(download.totalSize)}` :
                          download.downloadedSize > 0 ?
                            `${formatBytes(download.downloadedSize)} downloaded` :
                            'Preparing...'
                        }
                      </span>
                      {download.status === 'downloading' && download.speed > 0 && (
                        <span className="download-speed">
                          {formatSpeed(download.speed)}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="download-status">
                {(download.status === 'pending' || download.status === 'downloading') && <div className="spinner-small"></div>}
                {download.status === 'completed' && <span className="status-icon">✓</span>}
                {download.status === 'error' && <span className="status-icon error">✗</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const handleLogin = async (username: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Login failed');
      const data = await res.json();
      setToken(data.access_token);
      localStorage.setItem('token', data.access_token);
      fetchMe(data.access_token);
    } catch (err: any) {
      setAuthError(err.message || 'Error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (username: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Register failed');
      alert('Register success! Please login.');
      setMode('login');
    } catch (err: any) {
      setAuthError(err.message || 'Error');
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchMe = async (tk?: string) => {
    const accessToken = tk || token;
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error('Failed to fetch user');
      setUser(await res.json());
    } catch {
      setUser(null);
    }
  };

  React.useEffect(() => {
    if (token && !user) fetchMe();
  }, [token]);

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  // วิดีโอพื้นหลัง (แสดงตลอด)
  const backgroundVideo = (
    <>
      <video
        autoPlay
        loop
        muted
        playsInline
        className="login-bg-video"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          zIndex: 0,
          pointerEvents: 'none',
          filter: 'brightness(0.5)'
        }}
      >
        <source src="/zerotwo.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.0)', // overlay สว่างขึ้น
        zIndex: 1,
        pointerEvents: 'none',
      }} />
    </>
  );

  // ถ้ายังไม่ได้ล็อกอิน ให้แสดงเฉพาะ LoginForm
  if (!token || !user) {
    return (
      <>
        {backgroundVideo}
        <LoginForm
          onLogin={handleLogin}
          onRegister={handleRegister}
          mode={mode}
          setMode={setMode}
          loading={authLoading}
          error={authError}
        />
      </>
    );
  }

  // ล็อกอินแล้ว: แสดงเมนูหลัก (z-index:10) และเนื้อหาเว็บปกติ
  return (
    <>
      {backgroundVideo}
      <NavigationBar onShowCredits={() => setShowCredits(true)} user={user} onLogout={handleLogout} />
      {showCredits && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
          onClick={() => setShowCredits(false)}
        >
          <div
            style={{
              background: '#181818',
              borderRadius: 16,
              padding: 32,
              minWidth: 320,
              maxWidth: 400,
              color: '#ffd600',
              boxShadow: '0 4px 32px #000a',
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowCredits(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 16,
                background: 'none',
                border: 'none',
                color: '#ffd600',
                fontSize: 28,
                cursor: 'pointer',
              }}
            >×</button>
            <h2 style={{ color: '#ffd600', marginBottom: 12 }}>Credits & About</h2>
            <div style={{ color: '#fff', fontSize: 16, marginBottom: 16 }}>
              This project was created for the Minecraft community.<br />
              Thanks to Lisa and Bluecoin Community.<br />
              <br />
              <b>Contact & Links:</b>
              <ul style={{ color: '#ffd600', fontSize: 15, margin: '10px 0 0 0', padding: 0, listStyle: 'none' }}>
                <li>
                  <a href="https://discord.gg/your-discord-link" target="_blank" rel="noopener noreferrer" style={{ color: '#ffd600', textDecoration: 'underline' }}>
                    Discord Community
                  </a>
                </li>
                <li>
                  <a href="https://github.com/your-github-link" target="_blank" rel="noopener noreferrer" style={{ color: '#ffd600', textDecoration: 'underline' }}>
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
      {isMobile && isDownloadPanelOpen && (
        <div
          onClick={() => setIsDownloadPanelOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1199
          }}
        />
      )}
      <button
        onClick={() => setIsDownloadPanelOpen(open => !open)}
        style={isMobile ? {
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1201,
          background: '#ffd600',
          color: '#222',
          border: 'none',
          borderRadius: '50%',
          width: 56,
          height: 56,
          fontWeight: 'bold',
          fontSize: 22,
          cursor: 'pointer',
          boxShadow: '0 2px 8px #0004',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
        } : {
          position: 'fixed',
          top: 20,
          right: isDownloadPanelOpen ? 320 : 0,
          zIndex: 1201,
          background: '#ffd600',
          color: '#222',
          border: 'none',
          borderRadius: '8px 0 0 8px',
          padding: '10px 18px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 2px 8px #0004',
          transition: 'right 0.3s',
        }}
      >
        {isDownloadPanelOpen ? (isMobile ? '✕' : '→') : (isMobile ? '↓' : 'Downloads')}
      </button>
      {/* downloads panel */}
      {isDownloadPanelOpen && renderDownloadsPanel(isMobile)}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage handleDownload={handleDownload} downloads={downloads} />} />
        <Route path="/browse" element={<BrowsePage handleDownload={handleDownload} downloads={downloads} renderDownloadsPanel={renderDownloadsPanel} />} />
        <Route path="/about" element={<AboutPage />} />
        {user && user.role === 'admin' && (
          <Route path="/aboutme" element={<AboutMePage handleDownload={handleDownload} downloads={downloads} />} />
        )}
        {user && (
          <Route path="/profile" element={<ProfilePage user={user} />} />
        )}
        <Route path="/register" element={<AuthDemo />} />
        <Route path="/login" element={<AuthDemo />} />
      </Routes>
    </>
  );
}

export default App;

export async function downloadFileFromApi(
  itemId: string,
  title: string,
  apiUrl: string
): Promise<void> {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer zerotwo',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ item_id: itemId })
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    const disposition = response.headers.get('Content-Disposition');
    let filename = title + '.zip';
    if (disposition && disposition.includes('filename=')) {
      filename = disposition.split('filename=')[1].replace(/"/g, '').trim();
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    alert('Download error');
  }
}

// เพิ่ม AboutPage component สำหรับ /about
function AboutPage() {
  return (
    <div className="centered-page" style={{ textAlign: 'center', marginTop: 40 }}>
      <h1 style={{ color: '#ffd600', fontSize: 36, fontWeight: 'bold', marginBottom: 18 }}>About Zero Marketplace</h1>
      <p style={{ color: '#fff', fontSize: 18, marginBottom: 18 }}>
        Zero Marketplace is a community-driven platform for Minecraft content.<br />
        Created by Lisa and the Bluecoin Community.<br />
        <br />
        <b>Contact & Links:</b>
        <ul style={{ color: '#ffd600', fontSize: 16, margin: '10px auto', maxWidth: 400, textAlign: 'left', lineHeight: 1.7 }}>
          <li>Discord: <a href="https://discord.gg/your-discord-link" target="_blank" rel="noopener noreferrer" style={{ color: '#ffd600', textDecoration: 'underline' }}>Join our Discord</a></li>
          <li>GitHub: <a href="https://github.com/your-github-link" target="_blank" rel="noopener noreferrer" style={{ color: '#ffd600', textDecoration: 'underline' }}>Project Source</a></li>
        </ul>
        <br />
        <span style={{ color: '#ffd600' }}>Special thanks to all contributors and the Minecraft community!</span>
      </p>
    </div>
  );
}

function AboutMePage({ handleDownload, downloads }: { handleDownload: (itemId: string, title: string) => void, downloads: any[] }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const [imageMap, setImageMap] = useState<{ [id: string]: any }>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 12;
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!searchTag.trim()) return;
    setLoading(true);
    fetch(`http://localhost:8000/api/addons-by-tags?tags=${encodeURIComponent(searchTag)}&page=${page}&page_size=${pageSize}`, {
      headers: {
        'Authorization': 'Bearer zerotwo'
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then(data => {
        setItems(data.items || data); // support both array and {items, total}
        setTotal(data.total || (Array.isArray(data) ? data.length : 0));
        setTotalPages(data.total ? Math.ceil(data.total / pageSize) : 1);
        setLoading(false);
      })
      .catch(err => {
        setError('ไม่สามารถโหลดข้อมูลได้');
        setLoading(false);
      });
  }, [searchTag, page]);

  // Enrich images for all items after fetching
  useEffect(() => {
    if (items.length === 0) return;
    const ids = items.map(item => item.id).filter(Boolean);
    if (ids.length === 0) return;
    fetch('http://localhost:8000/api/enrich-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer zerotwo'
      },
      body: JSON.stringify({ item_ids: ids })
    })
      .then(res => res.json())
      .then(data => setImageMap(data))
      .catch(() => setImageMap({}));
  }, [items]);

  const handleSearch = () => {
    setPage(1);
    setSearchTag(tagInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Use the same thumbnail logic as ItemCard, but from imageMap
  const getThumbnailUrl = (item: any) => {
    const images = imageMap[item.id]?.Images || [];
    if (!images || images.length === 0) return '/placeholder.png';
    const thumb = images.find((img: any) => img.Tag === 'Thumbnail');
    if (thumb && thumb.Url) return thumb.Url;
    return images[0]?.Url || '/placeholder.png';
  };

  return (
    <div className="centered-page" style={{
      maxWidth: 1000,
      margin: '0 auto',
      padding: 32,
      background: 'rgba(0,0,0,0.85)',
      borderRadius: 24,
      zIndex: 2,
      position: 'relative',
      boxShadow: '0 8px 32px #000a',
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <h2 style={{ color: '#ffd600', fontWeight: 900, fontSize: 40, marginBottom: 32, letterSpacing: 1, fontFamily: 'M PLUS Rounded 1c, Noto Sans JP, Arial, sans-serif', textAlign: 'center' }}>
        เกี่ยวกับฉัน: <span style={{ color: '#fff', fontWeight: 700 }}>Addons</span> <span style={{ color: '#ffd600', fontWeight: 700 }}>(ค้นหาด้วย <span style={{ color: '#ffd600', fontWeight: 900 }}>tag</span>)</span>
      </h2>
      <div style={{ marginBottom: 32, display: 'flex', gap: 16, alignItems: 'center', width: '100%', justifyContent: 'center' }}>
        <input
          type="text"
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="เช่น tag.horror"
          style={{
            padding: '14px 20px',
            fontSize: 20,
            borderRadius: 10,
            border: '2px solid #ffd600',
            minWidth: 320,
            background: '#fff',
            color: '#222',
            fontWeight: 500,
            outline: 'none',
            boxShadow: '0 2px 8px #ffd60033',
            fontFamily: 'inherit',
          }}
        />
        <button onClick={handleSearch} style={{
          background: '#ffd600',
          color: '#222',
          fontWeight: 700,
          fontSize: 20,
          borderRadius: 10,
          padding: '12px 36px',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 2px 8px #ffd60033',
          transition: 'background 0.2s',
        }}>
          ค้นหา
        </button>
      </div>
      {/* Pagination controls */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{ background: '#ffd600', color: '#222', border: 'none', borderRadius: 8, padding: '6px 18px', fontWeight: 'bold', fontSize: 16, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.6 : 1 }}
        >Prev</button>
        <span style={{ color: '#ffd600', fontWeight: 'bold', fontSize: 18 }}>Page {page} / {totalPages}</span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{ background: '#ffd600', color: '#222', border: 'none', borderRadius: 8, padding: '6px 18px', fontWeight: 'bold', fontSize: 16, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.6 : 1 }}
        >Next</button>
      </div>
      {loading && <div style={{ color: '#ffd600', fontSize: 22, margin: 24 }}>กำลังโหลด...</div>}
      {error && <div style={{ color: 'red', fontSize: 18 }}>{error}</div>}
      <div className="results-list" style={{ width: '100%', marginTop: 8 }}>
        {items.map((item, idx) => {
          const mappedItem = {
            Id: item.id,
            Title: { 'en-US': item.title },
            DisplayProperties: { creatorName: item.creator },
            Tags: item.tags,
            canDownload: true, // หรือจะใส่ logic เฉพาะก็ได้
            Images: imageMap[item.id]?.Images || []
          };
          return (
            <ItemCard
              key={item.id || idx}
              item={mappedItem}
              index={idx}
              onDownload={handleDownload}
              downloads={downloads}
              disableDownload={false}
            />
          );
        })}
      </div>
      {items.length === 0 && !loading && !error && <div style={{ color: '#ffd600', fontSize: 20, marginTop: 32 }}>ไม่พบ Addon ที่มี {searchTag}</div>}
    </div>
  );
}

// เพิ่ม ProfilePage component
function ProfilePage({ user }: { user: any }) {
  const role = user.role || 'user';
  const [showSettings, setShowSettings] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadStatus(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadStatus('กรุณาเลือกไฟล์ก่อน');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('http://localhost:8000/api/upload-keys', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      if (!res.ok) throw new Error(await res.text());
      setUploadStatus('อัปโหลดไฟล์คีย์สำเร็จ!');
    } catch (err: any) {
      setUploadStatus('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถอัปโหลดได้'));
    }
  };

  return (
    <div
      className="centered-page"
      style={{
        textAlign: 'center',
        marginTop: 40,
        position: 'relative',
        zIndex: 10, // ให้ลอยเหนือวิดีโอ
        background: 'rgba(0,0,0,0.85)', // พื้นหลังโปร่งแสง
        borderRadius: 24,
        maxWidth: 400,
        marginLeft: 'auto',
        marginRight: 'auto',
        padding: 32,
        boxShadow: '0 8px 32px #000a',
      }}
    >
      <h1 style={{ color: '#ffd600', fontSize: 36, fontWeight: 'bold', marginBottom: 18 }}>โปรไฟล์</h1>
      <div style={{ color: '#fff', fontSize: 20, marginBottom: 12 }}>
        <b>ชื่อผู้ใช้:</b> {user.username}
      </div>
      <div style={{ color: '#ffd600', fontSize: 20, marginBottom: 12 }}>
        <b>บทบาท:</b> {role}
      </div>
      {user.role === 'admin' && (
        <div style={{ marginTop: 24 }}>
          <button
            style={{
              background: '#ffd600',
              color: '#222',
              fontWeight: 'bold',
              fontSize: 18,
              border: 'none',
              borderRadius: 8,
              padding: '12px 48px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px #0004',
              marginBottom: 12,
            }}
            onClick={() => setShowSettings(true)}
          >
            ตั้งค่า (Admin Settings)
          </button>
          {showSettings && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.7)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
              onClick={() => setShowSettings(false)}
            >
              <div
                style={{
                  background: '#181818',
                  borderRadius: 16,
                  padding: 32,
                  minWidth: 320,
                  maxWidth: 400,
                  color: '#ffd600',
                  boxShadow: '0 4px 32px #000a',
                  position: 'relative',
                }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowSettings(false)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 16,
                    background: 'none',
                    border: 'none',
                    color: '#ffd600',
                    fontSize: 28,
                    cursor: 'pointer',
                  }}
                >×</button>
                <h2 style={{ color: '#ffd600', marginBottom: 12 }}>ตั้งค่าระบบ (Admin)</h2>
                <form onSubmit={handleUploadKeys}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ color: '#fff', fontSize: 16 }}>อัปโหลดไฟล์คีย์ (.txt หรือ .db):</label><br />
                    <input type="file" ref={fileInputRef} accept=".txt,.db" style={{ marginTop: 8 }} />
                  </div>
                  <button type="submit" style={{
                    background: '#ffd600',
                    color: '#222',
                    fontWeight: 'bold',
                    fontSize: 16,
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 32px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px #0004',
                  }}>อัปโหลดไฟล์คีย์</button>
                </form>
                {uploadStatus && <div style={{ color: uploadStatus.startsWith('เกิด') ? 'red' : '#4caf50', marginTop: 16 }}>{uploadStatus}</div>}
              </div>
            </div>
          )}
        </div>
      )}
      <div style={{ color: '#aaa', fontSize: 16, marginTop: 24 }}>
        ข้อมูลนี้แสดงเฉพาะผู้ที่ล็อกอินเท่านั้น
      </div>
    </div>
  );
}






