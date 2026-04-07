// Lightbox functionality for image zoom
let currentImageIndex = 0;
let currentImageList = [];
let currentZoom = 1;
let isDragging = false;
let startX, startY, currentTranslateX = 0, currentTranslateY = 0, startTranslateX, startTranslateY;

window.openLightbox = function(imgSrc, imgAlt, imageList = [], startIndex = 0) {
    const modal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-image');

    currentImageList = imageList.length > 0 ? imageList : [imgSrc];
    currentImageIndex = startIndex;

    lightboxImg.src = imgSrc;
    lightboxImg.alt = imgAlt;
    modal.style.display = 'block';

    resetZoom();
    updateNavigationButtons();

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Add exit event listeners when modal opens
    addExitEventListeners();
};

window.closeLightbox = function() {
    const modal = document.getElementById('lightbox-modal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    resetZoom();

    // Remove exit event listeners when modal closes
    removeExitEventListeners();
};

function addExitEventListeners() {
    const lightboxImg = document.getElementById('lightbox-image');

    // Double-click to exit
    lightboxImg.addEventListener('dblclick', handleDoubleClickExit);

    // Right-click context menu to exit
    lightboxImg.addEventListener('contextmenu', handleRightClickExit);

    // Touch events for mobile double-tap to exit
    let lastTap = 0;
    lightboxImg.addEventListener('touchend', function(e) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 500 && tapLength > 0) {
            // Double tap detected
            handleDoubleClickExit(e);
        }
        lastTap = currentTime;
    });
}

function removeExitEventListeners() {
    const lightboxImg = document.getElementById('lightbox-image');

    lightboxImg.removeEventListener('dblclick', handleDoubleClickExit);
    lightboxImg.removeEventListener('contextmenu', handleRightClickExit);
}

function handleDoubleClickExit(e) {
    e.preventDefault();
    closeLightbox();
}

function handleRightClickExit(e) {
    e.preventDefault();
    // Create a simple context menu
    showExitContextMenu(e.clientX, e.clientY);
}

function showExitContextMenu(x, y) {
    // Remove any existing context menu
    const existingMenu = document.querySelector('.lightbox-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'lightbox-context-menu';
    menu.innerHTML = `
        <div class="context-menu-item" onclick="closeLightbox()">Close Lightbox</div>
        <div class="context-menu-item" onclick="resetZoom()">Reset Zoom</div>
    `;

    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.zIndex = '10002';

    document.body.appendChild(menu);

    // Remove menu when clicking elsewhere
    const removeMenu = function(e) {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', removeMenu);
        }
    };

    // Remove after a delay
    setTimeout(() => {
        if (menu.parentNode) {
            menu.remove();
        }
    }, 3000);

    document.addEventListener('click', removeMenu);
}

window.navigateImage = function(direction) {
    if (currentImageList.length <= 1) return;

    currentImageIndex += direction;

    if (currentImageIndex < 0) {
        currentImageIndex = currentImageList.length - 1;
    } else if (currentImageIndex >= currentImageList.length) {
        currentImageIndex = 0;
    }

    const lightboxImg = document.getElementById('lightbox-image');
    lightboxImg.src = currentImageList[currentImageIndex];
    resetZoom();
    updateNavigationButtons();
};

function updateNavigationButtons() {
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');

    if (currentImageList.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    } else {
        prevBtn.style.display = 'block';
        nextBtn.style.display = 'block';
    }
}

window.zoomIn = function() {
    currentZoom = Math.min(currentZoom + 0.25, 3);
    updateZoom();
};

window.zoomOut = function() {
    currentZoom = Math.max(currentZoom - 0.25, 0.25);
    updateZoom();
};

window.resetZoom = function() {
    currentZoom = 1;
    currentTranslateX = 0;
    currentTranslateY = 0;
    updateZoom();
};

function updateZoom() {
    const lightboxImg = document.getElementById('lightbox-image');
    const zoomLevel = document.getElementById('zoom-level');

    lightboxImg.style.transform = `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${currentZoom})`;
    zoomLevel.textContent = Math.round(currentZoom * 100) + '%';

    // Enable/disable pan based on zoom level
    const container = document.querySelector('.lightbox-image-container');
    if (currentZoom > 1) {
        container.style.cursor = 'grab';
        enablePan();
    } else {
        container.style.cursor = 'default';
        disablePan();
    }
}

function enablePan() {
    const container = document.querySelector('.lightbox-image-container');

    container.addEventListener('mousedown', startDrag);
    container.addEventListener('mousemove', drag);
    container.addEventListener('mouseup', endDrag);
    container.addEventListener('mouseleave', endDrag);

    // Touch events for mobile
    container.addEventListener('touchstart', startDrag, { passive: false });
    container.addEventListener('touchmove', drag, { passive: false });
    container.addEventListener('touchend', endDrag, { passive: false });
}

function disablePan() {
    const container = document.querySelector('.lightbox-image-container');

    container.removeEventListener('mousedown', startDrag);
    container.removeEventListener('mousemove', drag);
    container.removeEventListener('mouseup', endDrag);
    container.removeEventListener('mouseleave', endDrag);

    container.removeEventListener('touchstart', startDrag, { passive: false });
    container.removeEventListener('touchmove', drag, { passive: false });
    container.removeEventListener('touchend', endDrag, { passive: false });
}

function startDrag(e) {
    if (currentZoom <= 1) return;

    isDragging = true;
    const container = document.querySelector('.lightbox-image-container');
    container.style.cursor = 'grabbing';

    startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    startTranslateX = currentTranslateX;
    startTranslateY = currentTranslateY;
}

function drag(e) {
    if (!isDragging || currentZoom <= 1) return;
    e.preventDefault();

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    const diffX = clientX - startX;
    const diffY = clientY - startY;

    currentTranslateX = startTranslateX + diffX;
    currentTranslateY = startTranslateY + diffY;

    updateZoom();
}

function endDrag() {
    isDragging = false;
    if (currentZoom > 1) {
        const container = document.querySelector('.lightbox-image-container');
        container.style.cursor = 'grab';
    }
}

// Initialize lightbox functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Helper function to attach lightbox to a group of images
    function attachLightbox(images) {
        if (!images.length) return;
        const imageSources = Array.from(images).map(img => img.src);

        images.forEach((img, index) => {
            img.style.cursor = 'pointer';
            img.setAttribute('data-lightbox-handled', 'true');
            img.addEventListener('click', function() {
                openLightbox(this.src, this.alt, imageSources, index);
            });
        });
    }

    // 1. Handle Sections (#rooms, #gallery)
    ['#rooms', '#gallery'].forEach(id => {
        const section = document.querySelector(id);
        if (section) attachLightbox(section.querySelectorAll('img'));
    });

    // 2. Handle Classes (.experience-image, .experience-container.mixed-layout)
    document.querySelectorAll('.experience-image, .experience-container.mixed-layout').forEach(container => {
        attachLightbox(container.querySelectorAll('img'));
    });

    // 3. Handle Room Details
    document.querySelectorAll('.room-detail, .rooms-detail-section').forEach(section => {
        attachLightbox(section.querySelectorAll('img'));
    });

    // Also handle any remaining images that might be in other sections
    const allImages = document.querySelectorAll('img');
    allImages.forEach(img => {
        // Skip images that are already handled or are part of the lightbox itself
        if (!img.closest('#lightbox-modal') && !img.hasAttribute('data-lightbox-handled')) {
            img.setAttribute('data-lightbox-handled', 'true');
            img.style.cursor = 'pointer';
            img.addEventListener('click', function() {
                // For single images or images not in a group, just open that single image
                openLightbox(this.src, this.alt, [this.src], 0);
            });
        }
    });

    // Handle keyboard navigation
    document.addEventListener('keydown', function(e) {
        const modal = document.getElementById('lightbox-modal');
        if (modal.style.display === 'block') {
            switch(e.key) {
                case 'Escape':
                    closeLightbox();
                    break;
                case 'ArrowLeft':
                    navigateImage(-1);
                    break;
                case 'ArrowRight':
                    navigateImage(1);
                    break;
                case '+':
                case '=':
                    zoomIn();
                    break;
                case '-':
                    zoomOut();
                    break;
                case '0':
                    resetZoom();
                    break;
            }
        }
    });

    // Handle mouse wheel zoom
    document.addEventListener('wheel', function(e) {
        const modal = document.getElementById('lightbox-modal');
        if (modal.style.display === 'block') {
            e.preventDefault();
            if (e.deltaY < 0) {
                zoomIn();
            } else {
                zoomOut();
            }
        }
    }, { passive: false });
});