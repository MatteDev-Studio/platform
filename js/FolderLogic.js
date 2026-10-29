const folderButton = document.getElementById('openFolder');
const folderOverlay = document.getElementById('folderOverlay');

if (folderButton && folderOverlay) {
    folderButton.addEventListener('click', () => folderOverlay.classList.add('active'));

    folderOverlay.addEventListener('click', (event) => {
        if (event.target === folderOverlay || event.target.closest('.close-folder-btn')) {
            folderOverlay.classList.remove('active');
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') folderOverlay.classList.remove('active');
    });
}