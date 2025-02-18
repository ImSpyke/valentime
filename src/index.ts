import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execFile } from 'child_process';
import { path as ffprobe_path } from 'ffprobe-static';
import multer from 'multer';
import dotenv from 'dotenv'
import * as SF from 'somefunctions'
dotenv.config()

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

import cookieParser from 'cookie-parser';
app.use(cookieParser());

import * as Types from './types.js'

const LOCAL_TOKEN = process.env?.TOKEN ?? null

if(LOCAL_TOKEN == null || typeof LOCAL_TOKEN !='string' ) {
    throw new Error()
}

console.log("Loaded token:",LOCAL_TOKEN)
app.use((req, res, next) => {

    function noSiteError() {
        res.status(404).send('Not found');
        return;
    }
    console.log("Client cookies:",req.query?.cookie)
    const token = req.cookies?.token ?? null
    const sanitized_token = (token != null && typeof token === 'string') ? `${token ?? null}` : null
    console.log("LOCAL token:",LOCAL_TOKEN)
    console.log("client token:",sanitized_token)
    if(sanitized_token == null) { noSiteError(); return; }
    if (SF.isBufferEqual(Buffer.from(<string>process.env.TOKEN), Buffer.from(sanitized_token)) == false) {
        noSiteError()
        return;
    }
    next();
});


// create public/album and public/datas if not exist
const publicAlbumPath = path.join(__dirname, '../public/assets/album');
const publicDatasPath = path.join(__dirname, '../public/assets/datas');

if (!fs.existsSync(publicAlbumPath)) {
    fs.mkdirSync(publicAlbumPath, { recursive: true });
}

if (!fs.existsSync(publicDatasPath)) {
    fs.mkdirSync(publicDatasPath, { recursive: true });
}


function getVideoDuration(filePath:string) {
    return new Promise((resolve, reject) => {
        execFile(ffprobe_path, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], 
        (err: Error | null, stdout: string) => {
            if (err) return reject(err);
            resolve(parseFloat(stdout));
        });
    });
}




const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, 'public/assets/album/'); // Dossier où stocker les fichiers
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const mediaName = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${mediaName}${ext}`);
    }
});

const upload = multer({ storage });

app.post('/api/upload', upload.single('mediaFile'), (req, res): void => {
    if (!req.file) {
        res.status(400).json({ success: false, message: 'No file uploaded' });
        return;
    }

    // Récupération des autres données du formulaire
    const { mediaType, mediaName, uploadedBy } = req.body;

    const datas: Types.AlbumItem = {
        originalName:   req.file.originalname,
        storedName:     req.file.filename,
        path:           req.file.path,
        mediaType:      mediaType,
        mediaName:      mediaName,
        uploadedAt:     Date.now(),
        uploadedBy:     uploadedBy
    }
    console.log('File info:',datas)
    
    res.json({
        success: true,
        message: 'File uploaded successfully',
        file: datas
    });
    const metaDataPath = path.join(__dirname, '../public/assets/datas/album.json');
    let metaDatas: any = { items: [] };

    if (fs.existsSync(metaDataPath) && fs.statSync(metaDataPath).isFile()) {
        // If file exists, get the datas
        metaDatas = JSON.parse(fs.readFileSync(metaDataPath, 'utf-8'));
    } else {
        // If file doesn't exist, set to default datas
        metaDatas = { items: [] }
    }

    metaDatas.items.push(datas)
    /*{
        storedName: datas.storedName,
        fileName: req.file.filename,
        uploadBy: uploadedBy,
        uploadAt: Date.now()
    });*/

    const text = JSON.stringify(metaDatas, null, 2)
    fs.writeFileSync(metaDataPath, text, 'utf-8');
    const date = (new Date()).toISOString().substring(0,4+1+2+1+2) // 2025-02-14
    // Write a backup
    fs.writeFileSync(path.join(__dirname, `../public/assets/backups/datas/${date}-album.json`), text);
    return;
});


app.get("/api/album", async(_req,res) => {

    // Get album metadatas
    let metaDatas: Types.AlbumMetaDatas = { items: [] };
    
    const metaDataPath = path.join(__dirname, '../public', "./assets/datas/metadata.json");
    if (fs.existsSync(metaDataPath) && fs.statSync(metaDataPath).isFile()) {
        metaDatas = JSON.parse(fs.readFileSync(metaDataPath, 'utf-8'));
    }
    

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

            const metaData = metaDatas.items.find(item => item.storedName === file);

            return {
                type: type,
                url: `/assets/album/${file}`,
                uploadedBy: metaData?.uploadedBy ?? "Unknown", // Placeholder, replace with actual logic if available
                uploadedAt: stats.mtimeMs,
                name: metaData?.mediaName,
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