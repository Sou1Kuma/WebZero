import React, { useEffect } from 'react';

interface ItemCardProps {
  item: any;
  index?: number;
  onSelect?: (item: any) => void;
  onDownload?: (itemId: string, title: string) => void;
  downloads?: any[];
  disableDownload?: boolean;
}

const getThumbnailUrl = (images?: Array<{ Tag: string; Url: string }>) => {
  if (!images || images.length === 0) return null;
  const thumb = images.find(img => img.Tag === 'Thumbnail');
  if (thumb && thumb.Url) return thumb.Url;
  return images[0]?.Url || null;
};

const ItemCard: React.FC<ItemCardProps> = ({ item, index, onSelect, onDownload, downloads, disableDownload }) => {
  const thumbnailUrl = getThumbnailUrl(item.Images);
  const title = typeof item.Title === 'string' ? item.Title : item.Title?.['en-US'] || 'Unknown Title';
  const creator = item.DisplayProperties?.creatorName || 'Unknown Creator';
  const id = item.Id || item.id;
  const tags = item.Tags || [];
  const isSkinpack = tags.map((t: string) => t.toLowerCase()).includes('skinpack');
  const canShowDownloadBadge = item.canDownload || isSkinpack;

  // Only show these tags (ย้ายขึ้นมาประกาศตรงนี้ครั้งเดียว)
  const allowedTags = [
    'worldtemplate', 'addon', 'skinpack', 'texturepack', 'texture', 'mashup', 'mashups'
  ];
  const displayTags = tags.filter((tag: string) =>
    allowedTags.includes(tag.toLowerCase())
  );

  // Badge state (ใช้ข้อมูลจาก backend โดยตรง)
  const canDownload = item.canDownload;

  useEffect(() => {
    if (isSkinpack) {
      // setBadgeStatus('green'); // This line is removed
    } else if (displayTags.length > 0) {
      // Only check for non-skinpack allowed tags
      fetch(`/api/check-id-in-keys?item_id=${id}`)
        .then(res => res.json())
        .then(data => {
          // setBadgeStatus(data.found ? 'green' : 'red'); // This line is removed
        })
        .catch(() => {
          // setBadgeStatus('red'); // This line is removed
        });
    } else {
      // setBadgeStatus(null); // This line is removed
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isSkinpack, displayTags.join(',')]);

  const handleCardClick = (e: React.MouseEvent) => {
    if (onSelect) {
      onSelect(item);
    }
  };

  // Download button state
  let downloadItem = downloads?.find(d => d.id.startsWith(id + '_'));
  const isPending = downloadItem?.status === 'pending';
  const isDownloading = downloadItem?.status === 'downloading';

  return (
    <div className="result-item" onClick={handleCardClick} style={{ cursor: onSelect ? 'pointer' : undefined }}>
      <div className="result-header">
        {typeof index === 'number' && <div className="result-number">{index + 1}</div>}
        {onDownload && !disableDownload && canDownload && (
          <button
            className={`download-button${isPending ? ' pending' : ''}${isDownloading ? ' downloading' : ''}`}
            style={{ marginLeft: 'auto' }}
            onClick={e => { e.stopPropagation(); onDownload(id, title); }}
            disabled={isPending || isDownloading}
          >
            {isPending ? 'Pending...' : isDownloading ? 'Downloading...' : 'Download'}
          </button>
        )}
      </div>
      {thumbnailUrl && (
        <div className="result-thumbnail" style={{ position: 'relative' }}>
          <img
            src={thumbnailUrl}
            alt={`${title} thumbnail`}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {canShowDownloadBadge && (
            <span
              className="item-badge"
              style={{
                position: 'absolute',
                bottom: 6,
                right: 6,
                background: '#2ecc40',
                color: 'white',
                borderRadius: 8,
                padding: '2px 8px',
                fontSize: 14,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
              }}
            >
              ดาวน์โหลดได้
            </span>
          )}
          {/* Badge สีแดงสำหรับ item ที่ไม่ใช่ skinpack และดาวน์โหลดไม่ได้ */}
          {!isSkinpack && canDownload === false && (
            <span
              className="item-badge"
              style={{
                position: 'absolute',
                bottom: 6,
                right: 6,
                background: '#e74c3c',
                color: 'white',
                borderRadius: 8,
                padding: '2px 8px',
                fontSize: 14,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
              }}
            >
              ไม่สามารถดาวน์โหลดได้
            </span>
          )}
          {(item.hasMultipleTypes || (item.totalFiles && Number(item.totalFiles) > 1)) && (
            <div style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: '#ffd600',
              color: '#222',
              borderRadius: 6,
              padding: '4px 10px',
              fontWeight: 'bold',
              fontSize: 13,
              boxShadow: '0 1px 4px #0004',
              zIndex: 2
            }}>
              Multiple Files (.zip)
            </div>
          )}
        </div>
      )}
      <div className="result-content">
        <div className="result-title">{title}</div>
        <div className="result-creator">by {creator}</div>
        <div className="result-id">ID: {id}</div>
        {displayTags.length > 0 && (
          <div className="result-tags">
            {displayTags.map((tag: string, tagIndex: number) => (
              <span key={tagIndex} className="tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemCard; 