import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execFile } from 'child_process';
import { path as ffprobe_path } from 'ffprobe-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

function getVideoDuration(filePath:string) {
    return new Promise((resolve, reject) => {
        execFile(ffprobe_path, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], 
        (err: Error | null, stdout: string) => {
            if (err) return reject(err);
            resolve(parseFloat(stdout));
        });
    });
}


/*
const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
const port = 3000;

// Définir le stockage des fichiers
const storage = multer.diskStorage({
destination: (req, file, cb) => {
cb(null, 'uploads/'); // Dossier où stocker les fichiers
},
filename: (req, file, cb) => {
const ext = path.extname(file.originalname);
const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
cb(null, uniqueName);
}
});

const upload = multer({ storage });

// Endpoint d'upload
app.post('/api/upload', upload.single('mediaFile'), (req, res) => {
if (!req.file) {
return res.status(400).json({ success: false, message: 'No file uploaded' });
}

// Récupération des autres données du formulaire
const { mediaType, mediaName, uploadedBy } = req.body;

res.json({
success: true,
message: 'File uploaded successfully',
file: {
    originalName: req.file.originalname,
    storedName: req.file.filename,
    path: req.file.path,
    mediaType,
    mediaName,
    uploadedBy
}
});
});

// Démarrer le serveur
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
*/

app.get("/api/album", async(_req,res) => {

    // Get album metadatas
    let metaDatas: {
        items: Array<{
            fileName: string,
            uploadBy: string,
            uploadAt: number,

        }>
    } = JSON.parse(fs.readFileSync(path.join(__dirname, '../public', "./assets/album"), 'utf-8'));
    

    const albumPath = path.join(__dirname, '../public', "./assets/album");
    fs.readdir(albumPath, async (err, files) => {
        if (err) {
            console.log(`[/api/album] Error:`,err)
            res.status(500).send('Error reading album directory');
            return;
        }
        

        const album = files.map(async file => {
            const filePath = path.join(albumPath, file);
            const stats = fs.statSync(filePath);
            const ext = path.extname(file).toLowerCase();
            const type = ext === '.mp4' || ext === '.mov' ? 'video' : 'photo';

            return {
                type: type,
                url: `/assets/album/${file}`,
                uploadBy: 'unknown', // Placeholder, replace with actual logic if available
                uploadAt: stats.mtimeMs,
                name: file,
                duration: type === 'video' ? await getVideoDuration(filePath) : null
            };
        });

        let the_album = await Promise.all(album)

        res.json(the_album);
    });
})

app.get('*', (req, res): void => {

    if(req.path.startsWith("/assets/")) {
        if(fs.existsSync(path.join(__dirname, '../public', req.path))) {
            res.sendFile(path.join(__dirname, '../public', req.path));
        } else {
            res.status(404).send('Ressource Not found');
        }
        return;
    }
    
    if(req.path === '/') {
        res.sendFile(path.join(__dirname, '../public', 'index.html'));
        return
    }
    if(fs.existsSync(path.join(__dirname, '../public', `${req.path}.html`))) {
        res.sendFile(path.join(__dirname, '../public', `${req.path}.html`));
    } else {
        res.sendFile(path.join(__dirname, '../public', '404.html'));
    }
    return;

})


io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});