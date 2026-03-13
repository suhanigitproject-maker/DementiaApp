// services/albumService.js
/**
 * Album Service to handle interactions with the JSON file
 * The Albums backend endpoint expects: { "albums": [...] }
 */

window.albumService = {
    /**
     * Retrieves album data for display
     */
    getAlbums: async () => {
        try {
            const response = await fetch('/api/albums');
            if (response.ok) {
                const data = await response.json();
                return data.albums || [];
            }
        } catch (error) {
            console.error('Error loading albums:', error);
        }
        return [];
    },

    /**
     * Saves entire albums array to JSON
     */
    _saveAlbums: async (albumsArray) => {
        try {
            const response = await fetch('/api/albums', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ albums: albumsArray })
            });
            if (!response.ok) {
                throw new Error('Failed to save to server');
            }
        } catch (error) {
            console.error('Error saving albums:', error);
            throw error;
        }
    },

    /**
     * Creating new albums
     */
    createAlbum: async (albumsArray, title, description) => {
        const newAlbum = {
            id: 'album_' + Date.now().toString(),
            title: title,
            description: description,
            createdDate: new Date().toISOString().split('T')[0],
            photos: []
        };
        const newArray = [newAlbum, ...albumsArray];
        await window.albumService._saveAlbums(newArray);
        return newArray;
    },

    /**
     * Editing album title or description
     */
    updateAlbum: async (albumsArray, id, title, description) => {
        const index = albumsArray.findIndex(a => a.id === id);
        if (index !== -1) {
            albumsArray[index].title = title;
            if (description !== undefined) {
                albumsArray[index].description = description;
            }
            await window.albumService._saveAlbums(albumsArray);
        }
        return albumsArray;
    },

    /**
     * Deleting albums
     */
    deleteAlbum: async (albumsArray, id) => {
        const newArray = albumsArray.filter(a => a.id !== id);
        await window.albumService._saveAlbums(newArray);
        return newArray;
    },

    /**
     * Adding photos to albums
     */
    addPhotos: async (albumsArray, albumId, uploadedFiles) => {
        const album = albumsArray.find(a => a.id === albumId);
        if (!album) return albumsArray;

        if (!album.photos) album.photos = [];

        uploadedFiles.forEach(fileInfo => {
            album.photos.push({
                id: 'photo_' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
                imageURI: fileInfo.file_path || fileInfo.url, // images must be stored as URI/path references
                dateAdded: new Date().toISOString().split('T')[0]
            });
        });

        await window.albumService._saveAlbums(albumsArray);
        return albumsArray;
    },

    /**
     * Removing photos from albums
     */
    removePhoto: async (albumsArray, albumId, photoId) => {
        const album = albumsArray.find(a => a.id === albumId);
        if (!album) return albumsArray;

        album.photos = album.photos.filter(p => p.id !== photoId);
        await window.albumService._saveAlbums(albumsArray);
        return albumsArray;
    }
};
